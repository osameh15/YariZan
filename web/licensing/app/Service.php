<?php
declare(strict_types=1);
namespace YariZan\Licensing;

final class Service
{
    public function __construct(private \PDO $db, private string $keyPath) {}

    private function device(string $hwid): void
    {
        $stmt = $this->db->prepare('INSERT INTO devices (hwid) VALUES (?) ON DUPLICATE KEY UPDATE hwid = hwid');
        $stmt->execute([$hwid]);
    }

    public function status(string $hwid): array
    {
        $stmt = $this->db->prepare('SELECT trial_used FROM devices WHERE hwid = ?');
        $stmt->execute([$hwid]);
        $used = $stmt->fetchColumn();
        return ['remaining' => max(0, 2 - (int)($used === false ? 0 : $used))];
    }

    public function trial(string $hwid, string $nonce): array
    {
        if (!preg_match('/\A[A-F0-9]{64}\z/D', $nonce)) {
            throw new \InvalidArgumentException('Invalid request nonce.');
        }
        $this->db->beginTransaction();
        try {
            $this->device($hwid);
            $lock = $this->db->prepare('SELECT trial_used FROM devices WHERE hwid = ? FOR UPDATE');
            $lock->execute([$hwid]);
            $used = (int)$lock->fetchColumn();
            $prior = $this->db->prepare('SELECT remaining, signature FROM trial_grants WHERE hwid = ? AND nonce = ?');
            $prior->execute([$hwid, $nonce]);
            $grant = $prior->fetch(\PDO::FETCH_ASSOC);
            if ($grant !== false) {
                $this->db->commit();
                return ['hwid' => $hwid, 'nonce' => $nonce, 'remaining' => (int)$grant['remaining'], 'signature' => $grant['signature']];
            }
            if ($used >= 2) throw new TrialExhausted('Trial exhausted.');
            $remaining = 1 - $used;
            $signature = base64_encode(Crypto::sign($this->keyPath, "YariZan-Trial-v1|$hwid|$nonce|$remaining"));
            $stmt = $this->db->prepare('INSERT INTO trial_grants (hwid, nonce, remaining, signature) VALUES (?, ?, ?, ?)');
            $stmt->execute([$hwid, $nonce, $remaining, $signature]);
            $stmt = $this->db->prepare('UPDATE devices SET trial_used = trial_used + 1, last_seen_at = UTC_TIMESTAMP() WHERE hwid = ?');
            $stmt->execute([$hwid]);
            $this->db->commit();
            return compact('hwid', 'nonce', 'remaining', 'signature');
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function issue(string $hwid, string $name, string $notes, string $actor): string
    {
        $nameLength = preg_match_all('/./us', $name);
        $notesLength = preg_match_all('/./us', $notes);
        if ($nameLength === false || $notesLength === false || $nameLength > 120 || $notesLength > 1000) {
            throw new \InvalidArgumentException('Name or notes are too long.');
        }
        $this->db->beginTransaction();
        try {
            $this->device($hwid);
            $stmt = $this->db->prepare('SELECT serial FROM devices WHERE hwid = ? FOR UPDATE');
            $stmt->execute([$hwid]);
            $serial = $stmt->fetchColumn();
            if (!$serial) $serial = Crypto::serial($this->keyPath, $hwid);
            $stmt = $this->db->prepare('UPDATE devices SET customer_name = ?, notes = ?, serial = ?, issued_at = COALESCE(issued_at, UTC_TIMESTAMP()) WHERE hwid = ?');
            $stmt->execute([$name, $notes, $serial, $hwid]);
            $this->audit('issue_serial', $hwid, $actor);
            $this->db->commit();
            return $serial;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function resetTrial(string $hwid, string $actor): void
    {
        $this->db->beginTransaction();
        try {
            $this->device($hwid);
            // This update takes the same device row lock used by trial consumption.
            $stmt = $this->db->prepare('UPDATE devices SET trial_used = 0 WHERE hwid = ?');
            $stmt->execute([$hwid]);
            $stmt = $this->db->prepare('DELETE FROM trial_grants WHERE hwid = ?');
            $stmt->execute([$hwid]);
            $this->audit('reset_trial', $hwid, $actor);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function audit(string $action, string $hwid, string $actor): void
    {
        $stmt = $this->db->prepare('INSERT INTO audit_events (action, hwid, actor) VALUES (?, ?, ?)');
        $stmt->execute([$action, $hwid, $actor]);
    }
}

final class TrialExhausted extends \RuntimeException {}

import { defineNitroPlugin } from 'nitropack/runtime';
import { serverSiteMode } from '../utils/site-mode';

// Fail closed at startup: a missing, invalid or mismatched YARIZAN_SITE_MODE stops the server
// before it accepts any request.
export default defineNitroPlugin(() => {
  try {
    const mode = serverSiteMode();
    console.log(JSON.stringify({ event: 'site_mode_selected', mode }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'YARIZAN_SITE_MODE_INVALID');
    process.exit(1);
  }
});

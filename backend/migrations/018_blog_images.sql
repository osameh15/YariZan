CREATE TABLE blog_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 content_hash text UNIQUE NOT NULL,
 data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 350000),
 width integer NOT NULL CHECK (width BETWEEN 1 AND 1600),
 height integer NOT NULL CHECK (height BETWEEN 1 AND 1600),
 uploaded_by uuid NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE blog_posts ADD COLUMN cover_image text,
 ADD COLUMN cover_alt text NOT NULL DEFAULT '',
 ADD COLUMN cover_width integer,
 ADD COLUMN cover_height integer;
ALTER TABLE blog_posts ADD CONSTRAINT blog_cover_path CHECK (
 cover_image IS NULL OR cover_image ~ '^/blog-covers/[a-z0-9-]+\.webp$'
 OR cover_image ~ '^/blog-images/[0-9a-f-]{36}\.webp$'
);
UPDATE blog_posts SET cover_image='/blog-covers/' || slug || '.webp',
 cover_alt=CASE slug
 WHEN 'choosing-an-educational-game' THEN 'والد و کودک در حال انتخاب بازی با پازل و مکعب‌های چوبی'
 WHEN 'number-games-at-home' THEN 'دسته‌بندی مهره‌های چوبی رنگی روی میز برای بازی شمارش در خانه'
 WHEN 'getting-started-with-yarizan' THEN 'والد و کودک در کنار لپ‌تاپ با یک بازی آموزشی دربارهٔ شکل‌ها'
 ELSE 'همراهی والد با کودک هنگام پیدا کردن جای قطعهٔ پازل چوبی' END,
 cover_width=1536,cover_height=1024,revision=revision+1,updated_at=now()
WHERE slug IN ('choosing-an-educational-game','number-games-at-home',
 'getting-started-with-yarizan','helping-without-giving-the-answer');

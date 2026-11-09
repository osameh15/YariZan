import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { Request, Response } from "express";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Database } from "../database/database";
import { Security } from "../security/security";
import { Audit } from "../audit/audit";
import { requireCondition, ApiError } from "../common/errors";
import { Capabilities } from "../security/capabilities";
import { uuid } from "../common/schemas";

export const blogInput = z.strictObject({
  cover_image: z
    .string()
    .regex(/^\/(?:blog-covers\/[a-z0-9-]+|blog-images\/[0-9a-f-]{36})\.webp$/)
    .nullable()
    .optional(),
  cover_alt: z.string().trim().max(250).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(320),
  category: z.string().trim().min(2).max(60),
  body: z.string().trim().min(100).max(12000),
  seo_title: z.string().trim().max(160),
  seo_description: z.string().trim().max(320),
  state: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  expected_revision: z.number().int().min(0),
});
const publicFields =
  "slug,title,description,category,body,seo_title,seo_description,published_at,updated_at,cover_image,cover_alt,cover_width,cover_height";
export const blogImageInput = z.strictObject({
  data: z
    .string()
    .min(16)
    .max(460000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export const blogImageResponse = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
});
export const blogPostResponse = blogInput
  .omit({ expected_revision: true })
  .extend({
    id: uuid.optional(),
    revision: z.union([z.string(), z.number()]).optional(),
    state: blogInput.shape.state.optional(),
    published_at: z.string().nullable(),
    updated_at: z.string(),
    cover_width: z.number().nullable(),
    cover_height: z.number().nullable(),
  });
export const blogPageResponse = z.object({ posts: z.array(blogPostResponse) });
export const blogPublicPageResponse = z.object({
  posts: z.array(blogPostResponse.omit({ body: true })),
});
@Injectable()
export class Blog {
  constructor(
    private db: Database,
    private security: Security,
    private audit: Audit,
  ) {}
  async upload(req: Request, value: unknown) {
    const input = blogImageInput.parse(value);
    const admin = await this.db.transaction((c) =>
      this.security.admin(req, "blog.manage", c),
    );
    await this.security.rate("blog-image:" + admin.id, 30);
    const buffer = Buffer.from(input.data, "base64");
    requireCondition(
      buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ||
        buffer.subarray(0, 3).toString("hex") === "ffd8ff" ||
        (buffer.subarray(0, 4).toString() === "RIFF" &&
          buffer.subarray(8, 12).toString() === "WEBP"),
      "BLOG_IMAGE_INVALID",
    );
    let image: { data: Buffer; info: { width: number; height: number } };
    try {
      const source = sharp(buffer, {
        limitInputPixels: 24000000,
        failOn: "warning",
      });
      const meta = await source.metadata();
      requireCondition(
        ["png", "jpeg", "webp"].includes(meta.format ?? "") &&
          (meta.pages ?? 1) === 1,
        "BLOG_IMAGE_INVALID",
      );
      image = await source
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new ApiError("BLOG_IMAGE_INVALID");
    }
    requireCondition(image.data.length <= 350000, "BLOG_IMAGE_TOO_LARGE");
    const digest = createHash("sha256").update(image.data).digest("hex");
    return this.db.transaction(async (c) => {
      await this.security.admin(req, "blog.manage", c);
      const result = await c.query(
        "INSERT INTO blog_images(content_hash,data,width,height,uploaded_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(content_hash) DO UPDATE SET content_hash=EXCLUDED.content_hash RETURNING id,width,height",
        [digest, image.data, image.info.width, image.info.height, admin.id],
      );
      const row = result.rows[0];
      await this.audit.append(
        c,
        {
          type: "ADMIN",
          id: admin.id,
          correlationId: req.res!.locals.correlationId,
        },
        "blog.image_uploaded",
        row.id,
        { width: row.width, height: row.height },
      );
      return {
        url: `/blog-images/${row.id}.webp`,
        width: row.width,
        height: row.height,
      };
    });
  }
  async image(id: string, req?: Request) {
    uuid.parse(id);
    return this.db.transaction(async (c) => {
      if (req) await this.security.admin(req, "blog.manage", c);
      const result = await c.query(
        `SELECT data FROM blog_images WHERE id=$1 ${req ? "" : "AND EXISTS(SELECT 1 FROM blog_posts WHERE state='PUBLISHED' AND published_at<=now() AND cover_image='/blog-images/' || $1::text || '.webp')"}`,
        [id],
      );
      requireCondition(result.rows[0], "NOT_FOUND", 404);
      return result.rows[0].data as Buffer;
    });
  }
  async published(slug?: string) {
    const result = await this.db.query(
      `SELECT ${
        slug
          ? publicFields
          : publicFields
              .split(",")
              .filter((field) => field !== "body")
              .join(",")
      } FROM blog_posts WHERE state='PUBLISHED' AND published_at<=now() ${slug ? "AND slug=$1" : ""} ORDER BY published_at DESC,slug`,
      slug ? [slug] : [],
    );
    if (slug) {
      requireCondition(result.rows[0], "NOT_FOUND", 404);
      return result.rows[0];
    }
    return { posts: result.rows };
  }
  async list(req: Request) {
    return this.db.transaction(async (c) => {
      await this.security.admin(req, "blog.manage", c);
      return {
        posts: (
          await c.query(
            "SELECT * FROM blog_posts ORDER BY updated_at DESC,id LIMIT 200",
          )
        ).rows,
      };
    });
  }
  async save(req: Request, value: unknown, id?: string) {
    const input = blogInput.parse(value);
    if (id) uuid.parse(id);
    return this.db.transaction(async (c) => {
      const admin = await this.security.admin(req, "blog.manage", c);
      const current = id
        ? (
            await c.query("SELECT * FROM blog_posts WHERE id=$1 FOR UPDATE", [
              id,
            ])
          ).rows[0]
        : undefined;
      if (id) requireCondition(current, "NOT_FOUND", 404);
      requireCondition(
        Number(current?.revision ?? 0) === input.expected_revision,
        "STALE_REVISION",
        409,
      );
      // Once a URL has been public, keep it stable even after unpublishing.
      requireCondition(
        !current?.published_at || current.slug === input.slug,
        "BLOG_SLUG_LOCKED",
        409,
      );
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        "blog:" + input.slug,
      ]);
      const duplicate = await c.query(
        "SELECT id FROM blog_posts WHERE slug=$1 AND ($2::uuid IS NULL OR id<>$2)",
        [input.slug, id ?? null],
      );
      requireCondition(!duplicate.rowCount, "BLOG_SLUG_EXISTS", 409);
      const values = [
        input.slug,
        input.title,
        input.description,
        input.category,
        input.body,
        input.seo_title,
        input.seo_description,
        input.state,
        admin.id,
      ];
      const cover =
        input.cover_image === undefined
          ? (current?.cover_image ?? null)
          : input.cover_image;
      const alt = input.cover_alt ?? current?.cover_alt ?? input.title;
      let width: number | null = null,
        height: number | null = null;
      if (cover?.startsWith("/blog-images/")) {
        const media = await c.query(
          "SELECT width,height FROM blog_images WHERE id=$1",
          [uuid.parse(cover.slice(13, -5))],
        );
        requireCondition(media.rows[0], "BLOG_IMAGE_INVALID");
        width = media.rows[0].width;
        height = media.rows[0].height;
      } else if (cover) {
        requireCondition(
          [
            "choosing-an-educational-game",
            "number-games-at-home",
            "getting-started-with-yarizan",
            "helping-without-giving-the-answer",
            "place-value-with-household-objects",
            "shape-and-colour-pattern-games",
            "pattern-games-at-home",
            "more-less-and-equal-games",
          ].some((slug) => cover === `/blog-covers/${slug}.webp`),
          "BLOG_IMAGE_INVALID",
        );
        width = 1536;
        height = 1024;
      }
      requireCondition(
        !cover || alt.trim().length > 0,
        "BLOG_IMAGE_ALT_REQUIRED",
      );
      const result = current
        ? await c.query(
            `UPDATE blog_posts SET slug=$1,title=$2,description=$3,category=$4,body=$5,seo_title=$6,seo_description=$7,state=$8,updated_by=$9,updated_at=now(),revision=revision+1,published_at=CASE WHEN $8='PUBLISHED' THEN coalesce(published_at,now()) ELSE published_at END WHERE id=$10 RETURNING *`,
            [...values, id],
          )
        : await c.query(
            `INSERT INTO blog_posts(slug,title,description,category,body,seo_title,seo_description,state,updated_by,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $8='PUBLISHED' THEN now() END) RETURNING *`,
            values,
          );
      const post = result.rows[0];
      await c.query(
        "UPDATE blog_posts SET cover_image=$2,cover_alt=$3,cover_width=$4,cover_height=$5 WHERE id=$1",
        [post.id, cover, alt, width, height],
      );
      Object.assign(post, {
        cover_image: cover,
        cover_alt: alt,
        cover_width: width,
        cover_height: height,
      });
      await this.audit.append(
        c,
        {
          type: "ADMIN",
          id: admin.id,
          correlationId: req.res!.locals.correlationId,
        },
        current ? "blog.updated" : "blog.created",
        post.id,
        { state: post.state, revision: Number(post.revision), slug: post.slug },
      );
      return post;
    });
  }
}
@Controller("api/v2")
@Capabilities("PRODUCTION_CORE")
export class BlogController {
  constructor(private blog: Blog) {}
  @Get("blog/images/:id")
  async publicImage(@Param("id") id: string, @Res() res: Response) {
    const data = await this.blog.image(id);
    res.type("image/webp").send(data);
  }
  @Get("admin/blog/images/:id")
  @Capabilities("ADMIN_AUTH")
  async adminImage(
    @Req() req: Request,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const data = await this.blog.image(id, req);
    res.type("image/webp").send(data);
  }
  @Post("admin/blog/images")
  @Capabilities("ADMIN_AUTH")
  upload(@Req() req: Request, @Body() input: unknown) {
    return this.blog.upload(req, input);
  }
  @Get("blog") list() {
    return this.blog.published();
  }
  @Get("blog/:slug") detail(@Param("slug") slug: string) {
    blogInput.shape.slug.parse(slug);
    return this.blog.published(slug);
  }
  @Get("admin/blog")
  @Capabilities("ADMIN_AUTH")
  adminList(@Req() req: Request) {
    return this.blog.list(req);
  }
  @Post("admin/blog")
  @Capabilities("ADMIN_AUTH")
  create(@Req() req: Request, @Body() input: unknown) {
    return this.blog.save(req, input);
  }
  @Patch("admin/blog/:id")
  @Capabilities("ADMIN_AUTH")
  update(@Req() req: Request, @Param("id") id: string, @Body() input: unknown) {
    return this.blog.save(req, input, id);
  }
}

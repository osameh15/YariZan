import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { z } from "zod";
import { Database } from "../database/database";
import { Security } from "../security/security";
import { Audit } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { Capabilities } from "../security/capabilities";
import { uuid } from "../common/schemas";

export const blogInput = z.strictObject({
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
  "slug,title,description,category,body,seo_title,seo_description,published_at,updated_at";
export const blogPostResponse = blogInput
  .omit({ expected_revision: true })
  .extend({
    id: uuid.optional(),
    revision: z.union([z.string(), z.number()]).optional(),
    state: blogInput.shape.state.optional(),
    published_at: z.string().nullable(),
    updated_at: z.string(),
  });
export const blogPageResponse = z.object({ posts: z.array(blogPostResponse) });
@Injectable()
export class Blog {
  constructor(
    private db: Database,
    private security: Security,
    private audit: Audit,
  ) {}
  async published(slug?: string) {
    const result = await this.db.query(
      `SELECT ${publicFields} FROM blog_posts WHERE state='PUBLISHED' AND published_at<=now() ${slug ? "AND slug=$1" : ""} ORDER BY published_at DESC,slug`,
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

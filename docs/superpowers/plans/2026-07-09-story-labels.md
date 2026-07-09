# Story Labels (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-managed story **labels** (Hot / New / Editor's Choice…) with a per-label default lifecycle (days) + per-assignment override; each story carries **at most one** label; the label fully **replaces** the old computed NEW/HOT/TOP/VIP cover badge across backend, admin, app, and web.

**Architecture:** New `Label` table (global, not per-language) + three columns on `Story` (`labelId`, `labelAssignedAt`, `labelExpiresAt`) — one label per story, so no join table. A label is "active" when assigned and not past its expiry (computed at read time, no cron). Backend `/labels` CRUD mirrors the existing `categories` module; story create/update accepts `labelId` + optional `labelDurationDaysOverride`; `serializeStory` returns a `label` object (or null) instead of the removed `computeBadge`. Admin gets a "Quản lý Label" page (cloned from Categories) + a single-select label picker in the story form. Flutter migrates its badge field to the label object; web gains a net-new label badge (it never rendered the old badge).

**Tech Stack:** NestJS + Prisma (MySQL) + jest (`node node_modules/jest/bin/jest.js`); Next.js admin (TypeScript, react-hook-form + zod, Tailwind); Flutter (`novelverse`, `D:\SetupC\flutter\bin\flutter.bat`); Next.js web (`fe/apps/web`).

## Global Constraints

- **Backend repo:** `D:\SetupC\Projects\NovelApp\backend` (NestJS `be/`, admin `fe/apps/admin`, web `fe/apps/web`). **App repo (separate git):** `D:\SetupC\Projects\NovelApp\novelverse`.
- **Prisma naming:** snake_case `@map` on every column, `@@map` plural table name, integer PKs `Int @db.UnsignedInt`. New FK `labelId` → `@map("label_id") @db.UnsignedInt`.
- **One label per story.** Label display = single global `text` + `color` (+ optional `icon`) — **not** multi-language.
- **Label replaces the computed badge entirely:** delete `computeBadge`; a story with no active label returns `label: null` (no badge).
- **Lifecycle:** `label.defaultDurationDays` (null/0 = never expires); assignment may override via `labelDurationDaysOverride`. Expiry = `labelAssignedAt + days`; computed at read time.
- **Migrations:** repo `.gitignore` blocks `*.sql`, so migration files are NOT committed → **prod needs `prisma migrate deploy` / manual ALTER** (same caveat as read-along). If `prisma migrate dev` hangs on the shadow DB because the dev server holds connections, stop the BE dev server first, or apply the ALTER directly + `prisma migrate resolve --applied <name>`.
- **Admin guards:** write endpoints use `@UseGuards(JwtAccessGuard, RolesGuard) @Roles('ADMIN')`.
- **Commands:** BE jest `node node_modules/jest/bin/jest.js <path>` (from `be/`); BE typecheck `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (from `be/`); admin typecheck `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (from `fe/apps/admin`); Flutter `"/d/SetupC/flutter/bin/flutter.bat" test|analyze` (from `novelverse`); web build/typecheck from `fe/apps/web`.
- **Spec:** `docs/superpowers/specs/2026-07-09-story-labels-design.md`.

---

### Task 1: Prisma — `Label` model + `Story` label columns + migration

**Files:**
- Modify: `be/prisma/schema.prisma` (add `model Label`; add 3 columns + relation + index to `model Story`)
- Migration: `be/prisma/migrations/<ts>_add_labels_and_story_label/` (generated)

**Interfaces:**
- Produces: Prisma models `Label { id:number, name:string, text:string, color:string, textColor:string|null, icon:string|null, defaultDurationDays:number|null, createdAt, updatedAt, stories }` and `Story.labelId:number|null`, `Story.labelAssignedAt:Date|null`, `Story.labelExpiresAt:Date|null`, `Story.label: Label|null`.

- [ ] **Step 1: Add `model Label`** to `be/prisma/schema.prisma` (place near `model Category`):

```prisma
model Label {
  id                  Int      @id @default(autoincrement()) @db.UnsignedInt
  name                String   @unique @db.VarChar(60)
  text                String   @db.VarChar(40)
  color               String   @db.VarChar(20)
  textColor           String?  @map("text_color") @db.VarChar(20)
  icon                String?  @db.VarChar(60)
  defaultDurationDays Int?     @map("default_duration_days") @db.UnsignedInt
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  stories Story[]

  @@map("labels")
}
```

- [ ] **Step 2: Add label columns + relation + index to `model Story`** (inside the existing block; put scalars with the other scalars, relation with the other relations, index with the other `@@index`):

```prisma
  labelId         Int?      @map("label_id") @db.UnsignedInt
  labelAssignedAt DateTime? @map("label_assigned_at")
  labelExpiresAt  DateTime? @map("label_expires_at")
```
```prisma
  label Label? @relation(fields: [labelId], references: [id], onDelete: SetNull)
```
```prisma
  @@index([labelId])
```

- [ ] **Step 3: Create + apply the migration** (from `be/`):

Run: `node node_modules/prisma/build/index.js migrate dev --name add_labels_and_story_label`
Expected: creates `labels` table + `stories.label_id/label_assigned_at/label_expires_at` + FK, and regenerates the client.
If it hangs on the shadow DB: kill the BE dev server (whatever holds port 9001), then either re-run, or apply the SQL directly via mysql (`CREATE TABLE labels ...; ALTER TABLE stories ADD COLUMN label_id INT UNSIGNED NULL, ADD COLUMN label_assigned_at DATETIME NULL, ADD COLUMN label_expires_at DATETIME NULL, ADD CONSTRAINT ... FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE SET NULL;`) then `node node_modules/prisma/build/index.js migrate resolve --applied add_labels_and_story_label`.

- [ ] **Step 4: Regenerate client + typecheck** (from `be/`):

Run: `node node_modules/prisma/build/index.js generate`
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0 (Prisma types now include `Label` + `story.label*`).

- [ ] **Step 5: Commit** (from repo root `D:\SetupC\Projects\NovelApp\backend`):

```bash
git add be/prisma/schema.prisma be/prisma/migrations
git commit -m "feat(labels): Label model + Story label columns + migration"
```
Note: migration `.sql` is gitignored (won't be added) — expected; prod needs `migrate deploy`.

---

### Task 2: Backend `labels` module (CRUD) — mirror `categories`

**Files:**
- Create: `be/src/labels/dto/create-label.dto.ts`, `update-label.dto.ts`, `label-query.dto.ts`
- Create: `be/src/labels/labels.service.ts`, `labels.controller.ts`, `labels.module.ts`
- Modify: `be/src/app.module.ts` (register `LabelsModule`)
- Test: `be/src/labels/labels.service.spec.ts`

**Interfaces:**
- Consumes: Prisma `Label` (Task 1); `PrismaService` from `@/prisma/prisma.service`; `handlePrismaError` from `@/common/utils/error-handler.util`; guards `@/auth/guards/jwt-access.guard`, `@/auth/guards/roles.guard`, decorator `@/auth/decorators/roles.decorator`.
- Produces: `LabelsService.findAll(query)`, `findOne(id)`, `create(dto)`, `update(id,dto)`, `remove(id)`, `bulkRemove(ids)`; REST `GET /labels`, `GET /labels/:id`, `POST /labels`, `PATCH /labels/:id`, `DELETE /labels/:id`, `DELETE /labels/bulk/delete`.

- [ ] **Step 1: Write the failing service test** — `be/src/labels/labels.service.spec.ts`:

```ts
import { LabelsService } from './labels.service';

const db = { label: {} as any };
const prisma = db as any;

describe('LabelsService', () => {
  let service: LabelsService;
  beforeEach(() => { service = new LabelsService(prisma); });

  it('findAll returns {data, meta} with pagination', async () => {
    db.label.count = jest.fn().mockResolvedValue(2);
    db.label.findMany = jest.fn().mockResolvedValue([
      { id: 1, name: 'Hot', text: 'HOT', color: '#E4572E' },
      { id: 2, name: 'New', text: 'NEW', color: '#2E86E4' },
    ]);
    const res = await service.findAll({ page: 1, limit: 20 } as any);
    expect(res.data).toHaveLength(2);
    expect(res.meta).toEqual({ total: 2, page: 1, lastPage: 1 });
  });

  it('create passes fields through to prisma', async () => {
    db.label.create = jest.fn().mockResolvedValue({ id: 3 });
    await service.create({ name: 'Editor', text: "Editor's Choice", color: '#7C3AED', defaultDurationDays: 0 } as any);
    expect(db.label.create).toHaveBeenCalledWith({
      data: { name: 'Editor', text: "Editor's Choice", color: '#7C3AED', textColor: undefined, icon: undefined, defaultDurationDays: 0 },
    });
  });

  it('findOne throws NotFound when missing', async () => {
    db.label.findUnique = jest.fn().mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toThrow('99');
  });
});
```

- [ ] **Step 2: Run the test → FAIL** (from `be/`):

Run: `node node_modules/jest/bin/jest.js src/labels/labels.service.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the DTOs**

`be/src/labels/dto/create-label.dto.ts`:
```ts
import { IsHexColor, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateLabelDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  name: string;

  @IsString() @IsNotEmpty() @MaxLength(40)
  text: string;

  @IsString() @IsNotEmpty()
  color: string;

  @IsOptional() @IsString()
  textColor?: string;

  @IsOptional() @IsString() @MaxLength(60)
  icon?: string;

  @IsOptional() @IsInt() @Min(0)
  defaultDurationDays?: number;
}
```
`be/src/labels/dto/update-label.dto.ts`:
```ts
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateLabelDto {
  @IsOptional() @IsString() @MaxLength(60)
  name?: string;

  @IsOptional() @IsString() @MaxLength(40)
  text?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsString()
  textColor?: string;

  @IsOptional() @IsString() @MaxLength(60)
  icon?: string;

  @IsOptional() @IsInt() @Min(0)
  defaultDurationDays?: number;
}
```
`be/src/labels/dto/label-query.dto.ts`:
```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class LabelQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  limit?: number = 50;

  @IsOptional() @IsString()
  search?: string;
}
```

- [ ] **Step 4: Create the service** — `be/src/labels/labels.service.ts` (global, no language relation; note: labels are a tiny table read rarely, so NO cache — deliberate deviation from categories):

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelQueryDto } from './dto/label-query.dto';
import { handlePrismaError } from '@/common/utils/error-handler.util';

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: LabelQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const search = query.search;

    const where: Prisma.LabelWhereInput = search
      ? { OR: [{ name: { contains: search } }, { text: { contains: search } }] }
      : {};

    const [total, data] = await Promise.all([
      this.prisma.label.count({ where }),
      this.prisma.label.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);

    return { data, meta: { total, page, lastPage: Math.ceil(total / limit) } };
  }

  async findOne(id: number) {
    const label = await this.prisma.label.findUnique({ where: { id } });
    if (!label) throw new NotFoundException(`Label with ID ${id} not found`);
    return label;
  }

  async create(data: CreateLabelDto) {
    try {
      return await this.prisma.label.create({
        data: {
          name: data.name,
          text: data.text,
          color: data.color,
          textColor: data.textColor,
          icon: data.icon,
          defaultDurationDays: data.defaultDurationDays,
        },
      });
    } catch (error) {
      handlePrismaError(error, 'Label');
    }
  }

  async update(id: number, data: UpdateLabelDto) {
    try {
      await this.findOne(id);
      return await this.prisma.label.update({ where: { id }, data });
    } catch (error) {
      handlePrismaError(error, 'Label');
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.label.delete({ where: { id } });
  }

  async bulkRemove(ids: number[]) {
    return this.prisma.label.deleteMany({ where: { id: { in: ids } } });
  }
}
```

- [ ] **Step 5: Create the controller** — `be/src/labels/labels.controller.ts`:

```ts
import {
  Controller, Get, Post, Query, Body, Patch, Param, Delete, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelQueryDto } from './dto/label-query.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@ApiTags('Labels')
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @ApiOperation({ summary: 'Danh sách label' })
  @Get()
  findAll(@Query() query: LabelQueryDto) {
    return this.labelsService.findAll(query);
  }

  @ApiOperation({ summary: 'Chi tiết label' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.labelsService.findOne(id);
  }

  @ApiOperation({ summary: 'Tạo label (admin)' })
  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateLabelDto) {
    return this.labelsService.create(dto);
  }

  @ApiOperation({ summary: 'Cập nhật label (admin)' })
  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLabelDto) {
    return this.labelsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Xóa label (admin)' })
  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.labelsService.remove(id);
  }

  @ApiOperation({ summary: 'Xóa nhiều label (admin)' })
  @Delete('bulk/delete')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  bulkRemove(@Body('ids') ids: number[]) {
    return this.labelsService.bulkRemove(ids);
  }
}
```

- [ ] **Step 6: Create the module** — `be/src/labels/labels.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { LabelsService } from './labels.service';
import { LabelsController } from './labels.controller';

@Module({
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}
```

- [ ] **Step 7: Register in `be/src/app.module.ts`** — add the import near the other module imports and `LabelsModule` to the `imports` array right after `CategoriesModule`:

```ts
import { LabelsModule } from './labels/labels.module';
```
(in `imports: [ ... CategoriesModule, LabelsModule, AuthorsModule, ... ]`)

- [ ] **Step 8: Run test → PASS + typecheck** (from `be/`):

Run: `node node_modules/jest/bin/jest.js src/labels/labels.service.spec.ts`
Expected: PASS (3 tests).
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 9: Commit**

```bash
git add be/src/labels be/src/app.module.ts
git commit -m "feat(labels): backend labels module (CRUD)"
```

---

### Task 3: Story ↔ label assignment + serialize `label` (replace `computeBadge`)

**Files:**
- Modify: `be/src/stories/dto/create-story.dto.ts`, `be/src/stories/dto/update-story.dto.ts`
- Modify: `be/src/stories/stories.service.ts` (add `computeLabelFields` + `activeLabel`; wire into `create`/`updateStory`; rewrite `serializeStory`; delete `computeBadge`; add `label` to the 7 include/select sites)
- Test: `be/src/stories/story-label.spec.ts`

**Interfaces:**
- Consumes: `Label` (Task 1); `CreateStoryDto`/`UpdateStoryDto`.
- Produces: story responses now carry `label: { id, name, text, color, textColor, icon } | null` and NO `badge`. Story create/update accept `labelId?: number | null` + `labelDurationDaysOverride?: number`.

- [ ] **Step 1: Write the failing test** — `be/src/stories/story-label.spec.ts` (unit-tests the two pure helpers via a minimal service instance):

```ts
import { StoriesService } from './stories.service';

function makeService() {
  const prisma: any = { label: { findUnique: jest.fn() } };
  // Only the helpers under test are exercised; other deps unused.
  return new StoriesService(prisma, {} as any, {} as any, {} as any);
}

describe('story label helpers', () => {
  it('activeLabel: returns mapped label when not expired', () => {
    const s = makeService() as any;
    const future = new Date(Date.now() + 86_400_000);
    const out = s.activeLabel({ labelId: 1, labelExpiresAt: future, label: { id: 1, name: 'Hot', text: 'HOT', color: '#E4572E', textColor: null, icon: null } });
    expect(out).toEqual({ id: 1, name: 'Hot', text: 'HOT', color: '#E4572E', textColor: null, icon: null });
  });

  it('activeLabel: returns null when expired', () => {
    const s = makeService() as any;
    const past = new Date(Date.now() - 86_400_000);
    expect(s.activeLabel({ labelId: 1, labelExpiresAt: past, label: { id: 1 } })).toBeNull();
  });

  it('activeLabel: returns null when no label assigned', () => {
    const s = makeService() as any;
    expect(s.activeLabel({ labelId: null, label: null })).toBeNull();
  });

  it('computeLabelFields: null labelId clears assignment', async () => {
    const s = makeService() as any;
    expect(await s.computeLabelFields(null)).toEqual({ labelId: null, labelAssignedAt: null, labelExpiresAt: null });
  });

  it('computeLabelFields: uses override days for expiry', async () => {
    const s = makeService() as any;
    const r = await s.computeLabelFields(1, 10);
    expect(r.labelId).toBe(1);
    expect(r.labelExpiresAt).toBeInstanceOf(Date);
    const days = (r.labelExpiresAt.getTime() - r.labelAssignedAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(10);
  });

  it('computeLabelFields: 0/null default duration => no expiry', async () => {
    const s = makeService() as any;
    (s.prisma.label.findUnique as jest.Mock).mockResolvedValue({ defaultDurationDays: 0 });
    const r = await s.computeLabelFields(1);
    expect(r.labelExpiresAt).toBeNull();
  });
});
```
NOTE: adjust the `new StoriesService(...)` constructor arg count/order to match the real constructor when implementing (read the top of `stories.service.ts`); pass real deps as `{} as any` — only `prisma.label.findUnique` is used.

- [ ] **Step 2: Run → FAIL** (from `be/`):

Run: `node node_modules/jest/bin/jest.js src/stories/story-label.spec.ts`
Expected: FAIL (helpers not defined).

- [ ] **Step 3: Add DTO fields.** In `be/src/stories/dto/create-story.dto.ts` and `update-story.dto.ts`, add (note `@IsOptional` allows `null`, which is how the admin clears a label):

```ts
  @IsOptional()
  @IsInt()
  labelId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  labelDurationDaysOverride?: number;
```

- [ ] **Step 4: Add the two helpers** to `StoriesService` (anywhere among the private methods):

```ts
  private activeLabel(story: any):
    | { id: number; name: string; text: string; color: string; textColor: string | null; icon: string | null }
    | null {
    if (!story?.labelId || !story?.label) return null;
    if (story.labelExpiresAt) {
      const exp = new Date(story.labelExpiresAt).getTime();
      if (Date.now() >= exp) return null;
    }
    const l = story.label;
    return { id: l.id, name: l.name, text: l.text, color: l.color, textColor: l.textColor ?? null, icon: l.icon ?? null };
  }

  private async computeLabelFields(labelId: number | null, override?: number | null) {
    if (labelId == null) return { labelId: null, labelAssignedAt: null, labelExpiresAt: null };
    let days = override ?? null;
    if (days == null) {
      const lbl = await this.prisma.label.findUnique({ where: { id: labelId }, select: { defaultDurationDays: true } });
      days = lbl?.defaultDurationDays ?? null;
    }
    const now = new Date();
    const labelExpiresAt = days && days > 0 ? new Date(now.getTime() + days * 86_400_000) : null;
    return { labelId, labelAssignedAt: now, labelExpiresAt };
  }
```

- [ ] **Step 5: Rewrite `serializeStory` + delete `computeBadge`.** Replace the current `serializeStory` body and remove the entire `computeBadge` method:

```ts
  private serializeStory(story: any) {
    const label = this.activeLabel(story);
    const { label: _rawLabel, labelAssignedAt: _a, labelExpiresAt: _e, ...rest } = story;
    return {
      ...rest,
      label,
      language: this.extractLanguageKey(story.language) ?? story.language,
      totalViews: typeof story.totalViews === 'bigint' ? Number(story.totalViews) : story.totalViews,
    };
  }
```
Delete the `computeBadge(...)` method entirely.

- [ ] **Step 6: Wire assignment into `create()` and `updateStory()`.**

In `create()`: destructure the new fields out of the DTO and set the label columns on the `story.create` data:
```ts
    const { categoryIds, chapters, chapterIds, language, authorId, labelId, labelDurationDaysOverride, ...storyData } = data;
    const labelFields = labelId !== undefined ? await this.computeLabelFields(labelId, labelDurationDaysOverride) : {};
```
Then inside `this.prisma.story.create({ data: { ...normalizedStoryData, ...labelFields, author: {...}, ... } })` — spread `...labelFields` after `...normalizedStoryData`.

In `updateStory()`: destructure and set on the `story.update` data:
```ts
    const { categoryIds, language, authorId, labelId, labelDurationDaysOverride, ...storyData } = data;
    const labelFields = labelId !== undefined ? await this.computeLabelFields(labelId, labelDurationDaysOverride) : {};
```
Then in `this.prisma.story.update({ data: { ...normalizedStoryData, ...labelFields, ...(authorId ? {...} : {}), ... } })` — spread `...labelFields`.

- [ ] **Step 7: Add `label` to every read path that serializes a story.** In each of these `include`/`select` objects add the label relation so `serializeStory` can derive it. For `include`-based blocks (scalar `labelId/labelExpiresAt` come automatically) add:
```ts
        label: { select: { id: true, name: true, text: true, color: true, textColor: true, icon: true } },
```
Add it to: `create()` include (~line 118), `updateStory()` include (~line 730), `getHomeStories()` `storyInclude` (~line 190), `findAllAdmin()` include (~line 618), `findOneAdmin()` include (~line 664), `getStoryDetail()` include (~line 755).
For the `select`-based `exploreStories()` block (~lines 388-424), add the scalar expiry fields AND the relation:
```ts
          labelId: true,
          labelExpiresAt: true,
          label: { select: { id: true, name: true, text: true, color: true, textColor: true, icon: true } },
```
(Search the file for every `categories: {` occurrence — each is a story-serializing read path and each needs the sibling `label` added.)

- [ ] **Step 8: Run test → PASS + typecheck + full stories/labels suites** (from `be/`):

Run: `node node_modules/jest/bin/jest.js src/stories/story-label.spec.ts` → PASS.
Run: `node node_modules/jest/bin/jest.js src/labels src/stories` → all PASS.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 9: Commit**

```bash
git add be/src/stories
git commit -m "feat(labels): assign label to story + serialize label (remove computeBadge)"
```

---

### Task 4: Seed 3 default labels

**Files:**
- Modify: `be/prisma/seed.ts` (add a labels seeding block)

- [ ] **Step 1: Add a labels seed block** near the categories block in `be/prisma/seed.ts` (uses native `upsert` on the unique `name`):

```ts
  console.log('Seeding labels...');
  const labelsData = [
    { name: 'Hot', text: 'HOT', color: '#E4572E', defaultDurationDays: 7 },
    { name: 'New', text: 'NEW', color: '#2E86E4', defaultDurationDays: 14 },
    { name: "Editor's Choice", text: 'EDITOR', color: '#7C3AED', defaultDurationDays: null },
  ];
  for (const lb of labelsData) {
    await prisma.label.upsert({
      where: { name: lb.name },
      update: { text: lb.text, color: lb.color, defaultDurationDays: lb.defaultDurationDays },
      create: lb,
    });
  }
```

- [ ] **Step 2: Run the seed** (from `be/`):

Run: `node node_modules/prisma/build/index.js db seed` (or the repo's `prisma:seed` npm script if it needs dotenv).
Expected: no errors; 3 labels present. Verify: `node -e "const{PrismaClient}=require('@prisma/client');new PrismaClient().label.findMany().then(l=>{console.log(l.map(x=>x.name));process.exit(0)})"` prints `[ 'Hot', 'New', "Editor's Choice" ]`.

- [ ] **Step 3: Commit**

```bash
git add be/prisma/seed.ts
git commit -m "feat(labels): seed 3 default labels"
```

---

### Task 5: Admin — "Quản lý Label" nav + `/labels` CRUD page

**Files:**
- Modify: `fe/apps/admin/src/components/admin/AdminShellLayout.tsx` (nav item)
- Create: `fe/apps/admin/src/app/[lang]/labels/page.tsx` (clone of `categories/page.tsx`)
- Create: `fe/apps/admin/src/app/[lang]/labels/_components/LabelForm.tsx` (clone of `categories/_components/CategoryForm.tsx`)

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /labels` (Task 2) via the admin `apiClient` + `unwrapList`.
- Produces: a working label admin at route `/labels`.

- [ ] **Step 1: Add the nav item.** In `AdminShellLayout.tsx`, import the `Tag` icon from `lucide-react` (add to the existing lucide import) and insert into `navItems` immediately after the `/categories` entry:

```tsx
  { href: '/labels', label: 'Quản lý Label', icon: Tag },
```

- [ ] **Step 2: Create the labels list page** by cloning `fe/apps/admin/src/app/[lang]/categories/page.tsx` → `fe/apps/admin/src/app/[lang]/labels/page.tsx`, adapting exactly:
  - Rename `CategoriesPage`→`LabelsPage`, `Category` type→`Label` (`{ id:number; name:string; text:string; color:string; textColor?:string|null; icon?:string|null; defaultDurationDays?:number|null; createdAt?:string }`).
  - All `apiClient` calls `/categories*` → `/labels*` (list `GET /labels?page=&limit=&search=`, `POST /labels`, `PATCH /labels/{id}`, `DELETE /labels/{id}`, `DELETE /labels/bulk/delete`).
  - **Remove** the per-language filter (`AdminLanguageDropdown` + `language` query param) — labels are global.
  - Import + render `LabelForm` (Step 3) in the modal instead of `CategoryForm`.
  - Table columns: a **badge preview** cell (a pill showing `text` on background `color`), `name`, `defaultDurationDays` ("∞" when null/0), plus the existing search + row-select + delete controls.

- [ ] **Step 3: Create `LabelForm`** by cloning `categories/_components/CategoryForm.tsx` → `labels/_components/LabelForm.tsx`, adapting the zod schema + fields to:
```ts
const labelSchema = z.object({
  name: z.string().min(1, 'Bắt buộc'),
  text: z.string().min(1, 'Bắt buộc'),
  color: z.string().min(1, 'Bắt buộc'),        // hex; use <input type="color"> + a text input
  textColor: z.string().optional(),
  icon: z.string().optional(),
  defaultDurationDays: z.coerce.number().int().min(0).optional(),
});
```
  - Drop the slug auto-generation and the language field (not needed for labels).
  - Fields: name, text (chữ badge), color (`<input type="color">` bound to the hex value + a text field for manual hex), textColor (optional), icon (optional text), defaultDurationDays (number; helper text: "0 hoặc trống = không hết hạn").
  - Live preview: a pill rendering `watch('text')` on `watch('color')` background with `watch('textColor')` text color.
  - Submit payload: `{ name, text, color, textColor, icon, defaultDurationDays }` → `POST`/`PATCH` via the parent's handler (same modal open/close pattern as CategoryForm).

- [ ] **Step 4: Typecheck** (from `fe/apps/admin`):

Run: `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add fe/apps/admin/src/components/admin/AdminShellLayout.tsx "fe/apps/admin/src/app/[lang]/labels"
git commit -m "feat(labels): admin label management page + nav"
```

---

### Task 6: Admin — single-select Label picker in the story form

**Files:**
- Modify: `fe/apps/admin/src/app/[lang]/stories/_components/StoryForm.tsx`

**Interfaces:**
- Consumes: `GET /labels` (Task 2). Story create/update payload gains `labelId: number | null` + `labelDurationDaysOverride?: number` (Task 3 DTO).
- Produces: admin can assign/clear a label + set an override duration when editing a story.

- [ ] **Step 1: Extend the form types + schema.** In `StoryForm.tsx`:
  - Add to `StoryFormValues` zod: `labelId: z.number().nullable().optional()`, `labelDurationDaysOverride: z.coerce.number().int().min(0).optional()`.
  - Add to `StorySubmitPayload`: `labelId?: number | null; labelDurationDaysOverride?: number;`.
  - Add to `defaultValues` + the `reset(...)` mapping: `labelId: initialData?.labelId ?? null`, `labelDurationDaysOverride: undefined`. (When editing, `initialData` comes from `GET /stories/admin/{id}` — the story's stored `labelId` is available; the API also returns the serialized active `label` object.)

- [ ] **Step 2: Load labels.** Add a `labels` state + a `useEffect` on mount (mirror the categories load) calling `apiClient.get('/labels?limit=100')` → `unwrapList<Label>()` where `Label = { id:number; name:string; text:string; color:string }`.

- [ ] **Step 3: Render the picker in the "Phân loại" section** (right after the Category multi-select). Single-select `<select>` bound to `labelId` (RHF), with a "— Không label —" option (value `''` → maps to `null`), plus a number input for the override:

```tsx
<div className="flex flex-col space-y-1.5">
  <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Label (Hot/New…)</label>
  <select
    value={watch('labelId') ?? ''}
    onChange={(e) => setValue('labelId', e.target.value === '' ? null : Number(e.target.value), { shouldDirty: true })}
    className="admin-input appearance-none"
  >
    <option value="">— Không label —</option>
    {labels.map((l) => (<option key={l.id} value={l.id}>{l.name} ({l.text})</option>))}
  </select>
  <input
    type="number" min={0}
    placeholder="Số ngày gim (để trống = mặc định của label)"
    {...register('labelDurationDaysOverride', { valueAsNumber: true })}
    className="admin-input"
  />
</div>
```

- [ ] **Step 4: Include the fields in the submit payload.** Where `finalData` is built (next to `categoryIds: values.categoryIds`), add:
```ts
      labelId: values.labelId ?? null,
      ...(values.labelDurationDaysOverride != null && !Number.isNaN(values.labelDurationDaysOverride)
        ? { labelDurationDaysOverride: values.labelDurationDaysOverride } : {}),
```

- [ ] **Step 5: Typecheck** (from `fe/apps/admin`):

Run: `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → no new errors.

- [ ] **Step 6: Commit**

```bash
git add "fe/apps/admin/src/app/[lang]/stories/_components/StoryForm.tsx"
git commit -m "feat(labels): label picker + duration override in story form"
```

---

### Task 7: Flutter app — migrate cover badge to the label object

**Files (repo `D:\SetupC\Projects\NovelApp\novelverse`):**
- Modify: `lib/models/models.dart` (`Book` — replace `tag` with a label)
- Modify: `lib/data/mappers/book_mapper.dart` (parse `label`; drop demo/whitelist)
- Modify: `lib/screens/novel/novel_home_screen.dart` (`_badge` uses label color; call sites use `b.label`)
- Test: `test/data/book_label_test.dart`

**Interfaces:**
- Consumes: story JSON field `label: { text, color, icon } | null` (Task 3).
- Produces: `Book.label` (`StoryLabel?`), rendered as a colored cover badge.

- [ ] **Step 1: Write the failing test** — `test/data/book_label_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/mappers/book_mapper.dart';

void main() {
  test('maps label object from JSON', () {
    final b = BookMapper.fromJson({'id': 's1', 'title': 'X', 'label': {'text': 'HOT', 'color': '#E4572E'}});
    expect(b.label, isNotNull);
    expect(b.label!.text, 'HOT');
    expect(b.label!.color, '#E4572E');
  });

  test('null label => no badge', () {
    final b = BookMapper.fromJson({'id': 's2', 'title': 'Y'});
    expect(b.label, isNull);
  });
}
```

- [ ] **Step 2: Run → FAIL** (from `novelverse`):

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/book_label_test.dart`
Expected: FAIL.

- [ ] **Step 3: Add `StoryLabel` + replace `Book.tag`.** In `lib/models/models.dart`, add:
```dart
class StoryLabel {
  const StoryLabel({required this.text, required this.color, this.icon});
  final String text;
  final String color; // hex, e.g. "#E4572E"
  final String? icon;
}
```
In `Book`: replace the `this.tag` constructor param + `final String? tag;` field with `this.label` + `final StoryLabel? label;`. Update every existing `tag:` usage in `Book(...)` constructions (search `lib/` for `tag:` — demo_data.dart may pass `tag:` strings; convert those to `label: StoryLabel(text: '...', color: '#...')` or drop them).

- [ ] **Step 4: Update the mapper.** In `lib/data/mappers/book_mapper.dart`, remove `_badge`, `_demoTag`, and the `tag:` line; add a `label:` line + parser:
```dart
      label: _label(j['label']),
```
```dart
  static StoryLabel? _label(dynamic v) {
    if (v is! Map) return null;
    final text = (v['text'] ?? '').toString();
    final color = (v['color'] ?? '').toString();
    if (text.isEmpty || color.isEmpty) return null;
    return StoryLabel(text: text, color: color, icon: v['icon']?.toString());
  }
```

- [ ] **Step 5: Update the badge widget.** In `lib/screens/novel/novel_home_screen.dart`, change the shared helper + both call sites:
```dart
  Widget _badge(StoryLabel label) {
    Color bg = Colors.black.withValues(alpha: 0.55);
    final hex = label.color.replaceFirst('#', '');
    if (hex.length == 6) bg = Color(int.parse('FF$hex', radix: 16));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: rounded(6)),
      child: Text(label.text, style: AppType.tabLabel(color: Colors.white).copyWith(fontSize: 9.5)),
    );
  }
```
Call sites: `if (b.tag != null) ... _badge(b.tag!)` → `if (b.label != null) ... _badge(b.label!)` (both places, ~lines 415-418 and 465-469).

- [ ] **Step 6: Run test + analyze** (from `novelverse`):

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/book_label_test.dart` → PASS.
Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 new errors/warnings (pre-existing `unnecessary_underscores` infos OK).

- [ ] **Step 7: Commit** (in `novelverse`):

```bash
git add lib/models/models.dart lib/data/mappers/book_mapper.dart lib/screens/novel/novel_home_screen.dart lib/models/demo_data.dart test/data/book_label_test.dart
git commit -m "feat(reader): render cover badge from story label (drop demo tag)"
```

---

### Task 8: Web — net-new label badge on the story card

**Files (repo `D:\SetupC\Projects\NovelApp\backend`, web app `fe/apps/web`):**
- Modify: `fe/apps/web/.../StoryGridCard.tsx` (add `label` to the item type + render a badge)
- Modify: the web story mapper/fetch that builds `StoryItem` (add `label` passthrough)

**Interfaces:**
- Consumes: story JSON `label: { text, color, icon } | null` (Task 3).
- Note: the web currently does NOT render the old badge at all — this is **net-new** (independent of the existing client-side "highlightMode" ribbon; leave that alone).

- [ ] **Step 1: Locate the card + item type.** Find `StoryGridCard.tsx` under `fe/apps/web/src` and its `StoryItem` type + the mapper/fetch that populates it (search for `StoryItem` / where stories are fetched for the grid). Confirm the near-duplicate at `fe/apps/admin/src/components/shared/StoryGridCard.tsx` is NOT the one the web renders (if the web imports the shared one, apply the change there and verify it doesn't break admin usage).

- [ ] **Step 2: Add `label` to the item type + mapper.** Add `label?: { text: string; color: string; icon?: string | null } | null` to `StoryItem`, and in the mapper/fetch pass `label: s.label ?? null` from the API response.

- [ ] **Step 3: Render the badge on the card** (a positioned pill over the cover, mirroring the app's look):
```tsx
{item.label ? (
  <span
    className="absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold"
    style={{ backgroundColor: item.label.color, color: item.label.icon ? undefined : '#fff' }}
  >
    {item.label.text}
  </span>
) : null}
```
(Ensure the cover container is `relative`.)

- [ ] **Step 4: Typecheck/build** (from `fe/apps/web`):

Run: `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (or the app's typecheck script) → no new errors.

- [ ] **Step 5: Commit**

```bash
git add fe/apps/web
git commit -m "feat(labels): show story label badge on web story card"
```

---

### Task 9: Full verification + manual smoke

- [ ] **Step 1: Backend** (from `be/`): `node node_modules/jest/bin/jest.js src/labels src/stories` → all PASS; `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] **Step 2: Admin** (from `fe/apps/admin`): `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → no errors.
- [ ] **Step 3: App** (from `novelverse`): `"/d/SetupC/flutter/bin/flutter.bat" test` → all PASS; `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 error/warning.
- [ ] **Step 4: Web** (from `fe/apps/web`): typecheck/build → clean.
- [ ] **Step 5: Manual (local, ports 9001/9002/9003):** create a label in admin `/labels`; edit a story → assign the label (+ override days) → save; hit `GET /stories/:slug` and confirm `label` present + no `badge`; assign a label with 0 days → active; set an already-expired assignment (or a 1-day label + backdate) → confirm it drops from serialization; delete the label → story's `label` becomes null (SetNull), no error; check the app home + web grid show the colored badge.
- [ ] **Step 6: Commit** any fixups.

## Notes / follow-ups
- Prod DB needs the migration applied via `prisma migrate deploy` (SQL is gitignored).
- Auto-apply "New" on publish (replacing the old ≤30-day behavior) — follow-up if wanted.
- Housekeeping job to null out expired `labelId` — optional (expiry is computed at read time).
- Sub-projects **B** (9 metrics + geo-IP) and **C** (Top menus) are separate cycles.

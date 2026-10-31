/**
 * MT Nexus Global ERP — LocalStorage Data Migration Utility
 * Imports JSON exported from browser localStorage (window.store.exportJson())
 * directly into PostgreSQL with Zod validation, deduplication and relational integrity.
 */

const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const fs = require('fs');

const prisma = new PrismaClient();

// Validation Schemas
const TaskSchema = z.object({
  id: z.number().int().positive(),
  t: z.string().min(1),
  cat: z.string().optional(),
  proj: z.string().optional(),
  who: z.string().optional(),
  pr: z.string().optional(),
  stage: z.number().int().min(0).max(5).default(0),
  due: z.string().optional(),
  desc: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ups: z.array(z.any()).optional()
});

async function migrateLocalStorageData(filePathOrJsonObject) {
  let data;
  if (typeof filePathOrJsonObject === 'string') {
    const raw = fs.readFileSync(filePathOrJsonObject, 'utf-8');
    data = JSON.parse(raw);
  } else {
    data = filePathOrJsonObject;
  }

  const results = {
    tasksImported: 0,
    tasksSkipped: 0,
    employeesImported: 0,
    errors: []
  };

  console.log('📦 Starting localStorage import validation & migration...');

  // Ensure organization
  const org = await prisma.organization.findFirst();
  if (!org) {
    throw new Error('Organization not initialized. Run seed.js first.');
  }

  // Tasks migration
  if (Array.isArray(data.tasks)) {
    for (const rawTask of data.tasks) {
      const parsed = TaskSchema.safeParse(rawTask);
      if (!parsed.success) {
        results.errors.push(`Invalid task #${rawTask.id}: ${parsed.error.message}`);
        continue;
      }
      const t = parsed.data;

      // Find matched project
      let projectId = null;
      if (t.proj) {
        const proj = await prisma.project.findFirst({ where: { name: { contains: t.proj, mode: 'insensitive' } } });
        if (proj) projectId = proj.id;
      }

      await prisma.task.upsert({
        where: { id: t.id },
        update: {
          title: t.t,
          stage: t.stage,
          priority: t.pr || 'Medium',
          dueDate: t.due ? new Date(t.due) : null,
          tags: t.tags || [],
          description: t.desc || '',
        },
        create: {
          id: t.id,
          projectId,
          title: t.t,
          stage: t.stage,
          priority: t.pr || 'Medium',
          dueDate: t.due ? new Date(t.due) : null,
          tags: t.tags || [],
          description: t.desc || '',
          category: t.cat || 'Web App',
        }
      });
      results.tasksImported++;
    }
  }

  console.log(`✅ Migration complete: ${results.tasksImported} tasks imported/updated, ${results.errors.length} errors.`);
  return results;
}

module.exports = {
  migrateLocalStorageData,
};

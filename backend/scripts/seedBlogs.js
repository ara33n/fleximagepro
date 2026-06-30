const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDatabase } = require('../config/db');
const Blog = require('../models/Blog');

const seedPath = process.env.BLOG_SEED_FILE
  ? path.resolve(process.env.BLOG_SEED_FILE)
  : path.resolve(__dirname, '..', 'seeds', 'blog-posts.json');

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function main() {
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Blog seed file not found: ${seedPath}`);
  }

  await connectDatabase();
  const posts = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  if (!Array.isArray(posts)) {
    throw new Error('Blog seed file must be a JSON array.');
  }

  let upserted = 0;
  for (const post of posts) {
    if (!post.slug || !post.title) {
      continue;
    }
    await Blog.updateOne(
      { slug: post.slug },
      {
        $set: {
          title: post.title,
          excerpt: post.excerpt,
          metaDescription: post.metaDescription,
          category: post.category,
          date: normalizeDate(post.date),
          readTime: post.readTime || '6 min read',
          tags: post.tags || [],
          heroTool: post.heroTool || {},
          sections: post.sections || [],
          faqs: post.faqs || [],
          status: post.status || 'published',
          updatedBy: 'seed',
        },
        $setOnInsert: {
          createdBy: 'seed',
        },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  console.log(`Seeded ${upserted} blog posts from ${seedPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

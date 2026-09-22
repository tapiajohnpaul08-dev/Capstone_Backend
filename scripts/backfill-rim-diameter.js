/**
 * scripts/backfill-rim-diameter.js
 * One-time migration: attach rimDiameter to every cup size.
 * Idempotent. Run from Capstone_Backend root:
 *   node scripts/backfill-rim-diameter.js --dry-run
 *   node scripts/backfill-rim-diameter.js --apply
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product.Model');

const APPLY = process.argv.includes('--apply');

const RIM_RULES = [
  // Shot cups — no lids exist
  { match: /hard\s*plastic\s*shot/i, rim: null, note: 'shot cups have no lids' },

  // Most specific first
  { match: /frosted\s*pp\s*u/i,      rim: 95 },
  { match: /pp\s*slim/i,             rim: 90 },
  {
    match: /pp\s*injection/i,
    rim: (size) => (size === '16oz' ? 95 : 90),
    note: '16oz = 95mm, others 90mm',
  },
  { match: /pp\s*u-?cups?/i,         rim: 95 },
  { match: /pp\s*y-?cups?/i,         rim: 95 },

  // PET — all 98mm
  { match: /pet\s*ultra/i,           rim: 98 },
  { match: /pet\s*u-?cups?/i,        rim: 98 },
  { match: /pet\s*cups?/i,           rim: 98 },

  // Hard cups — 95mm except 1L
  {
    match: /hard\s*cups?/i,
    rim: (size) => (size === '1l' ? null : 95),
    note: '1L has no listed lid',
  },

  // Paper cups
  { match: /single\s*wall/i,         rim: 90 },
  { match: /double\s*wall/i,         rim: 90 },
];

function resolveRim(productName, sizeName) {
  const size = String(sizeName || '').trim().toLowerCase();
  for (const rule of RIM_RULES) {
    if (rule.match.test(productName)) {
      if (typeof rule.rim === 'function') {
        return { rim: rule.rim(size), reason: 'rule-fn', note: rule.note };
      }
      if (rule.rim === null) return { rim: null, reason: 'no-lid', note: rule.note };
      return { rim: rule.rim, reason: 'rule' };
    }
  }
  return { rim: null, reason: 'no-rule' };
}

async function main() {
  if (!process.env.MONGO_DB_ONLINE) {
    console.error('❌ MONGO_DB_ONLINE not set in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_DB_ONLINE);
  console.log('✅ Connected to MongoDB\n');

  const products = await Product.find({
    category: { $in: ['Plastic Cups', 'Paper Cups'] },
  });

  console.log(`Found ${products.length} cup products to scan.\n`);

  let touched = 0;
  let skipped = 0;
  const unresolved = [];
  const noLidOnPurpose = [];

  for (const product of products) {
    let productChanged = false;
    const perSize = [];

    for (const size of product.sizes) {
      if (size.rimDiameter) {
        skipped++;
        perSize.push(`${size.name}=✓`);
        continue;
      }

      const { rim, reason, note } = resolveRim(product.name, size.name);

      if (reason === 'no-lid') {
        noLidOnPurpose.push({ product: product.name, size: size.name, note: note || '' });
        perSize.push(`${size.name}=—`);
        continue;
      }

      if (rim) {
        size.rimDiameter = rim;
        productChanged = true;
        perSize.push(`${size.name}=${rim}mm`);
      } else {
        unresolved.push({ product: product.name, size: size.name, reason });
        perSize.push(`${size.name}=??`);
      }
    }

    if (productChanged) {
      if (APPLY) {
        product.updatedAt = new Date();
        await product.save();
      }
      touched++;
      console.log(`  ${APPLY ? '✅' : '📝'} ${product.name}`);
      console.log(`     ${perSize.join('  ')}`);
    } else {
      console.log(`  ⏭️  ${product.name} — no changes (${perSize.join('  ')})`);
    }
  }

  console.log(`\n─── Summary ───`);
  console.log(`Products ${APPLY ? 'updated' : 'would update'}: ${touched}`);
  console.log(`Sizes already set (skipped): ${skipped}`);
  console.log(`Intentionally no lid: ${noLidOnPurpose.length}`);
  console.log(`Unresolved: ${unresolved.length}`);

  if (noLidOnPurpose.length) {
    console.log('\nNo-lid products (expected):');
    noLidOnPurpose.forEach((u) =>
      console.log(`  ℹ️  ${u.product} - ${u.size}${u.note ? ` (${u.note})` : ''}`),
    );
  }
  if (unresolved.length) {
    console.log('\nUnresolved (need a rule):');
    unresolved.forEach((u) => console.log(`  ⚠️  ${u.product} - ${u.size} (${u.reason})`));
  }

  if (!APPLY) console.log('\n👉 Dry run only. Re-run with --apply to write.');
  else console.log('\n✅ Backfill complete.');

  await mongoose.disconnect();
}

main().catch((e) => { console.error('❌ Fatal:', e); process.exit(1); });
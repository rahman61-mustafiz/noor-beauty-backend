/* One-off: add the "Monsoon Package" category + 2 packages to the WEBSITE's
   Supabase database (noor-salon.com), via the service_role key. Separate
   system from MongoDB — see scripts/addMonsoonPackages.js for the tablet/app
   side. Run once:
     node scripts/addMonsoonPackagesWebsite.js */
const axios = require('axios');

const SB_URL = process.env.SUPABASE_URL || 'https://cslytyetzhhfgqsrbrjn.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbHl0eWV0emhoZmdxc3JicmpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTcwMTg4OCwiZXhwIjoyMDk3Mjc3ODg4fQ.LYK_QThxTtZ-wQc8ZzHYGQOFEDPeJmHvO4GTPbjQowU';

const headers = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const PACKAGES = [
  {
    name: 'Monsoon Package 1',
    price: 2500,
    includes: [
      'Drizzle Shine and Glow Facial',
      'Sparkling Hand Polish Massage with Exfoliation',
      'Hair Fall Defense Therapy',
      'Foot Nourishing Therapy with Exfoliation',
    ],
  },
  {
    name: 'Monsoon Package 2',
    price: 3000,
    includes: [
      'Monsoon Detox Facial with D-Tan Mask',
      'Monsoon Hand Spa Massage with Glow Boost Pack',
      'Monsoon Scalp and Hair Detox Therapy',
      'Foot and Leg Relaxation with Detox Pack',
    ],
  },
];

async function main() {
  const existingCat = await axios.get(
    `${SB_URL}/rest/v1/categories?slug=eq.monsoon-package&select=*`,
    { headers }
  );

  let category;
  if (existingCat.data.length) {
    category = existingCat.data[0];
    console.log('Category "monsoon-package" already exists, reusing it');
  } else {
    const maxOrderRes = await axios.get(
      `${SB_URL}/rest/v1/categories?select=sort_order&order=sort_order.desc&limit=1`,
      { headers }
    );
    const nextOrder = (maxOrderRes.data[0]?.sort_order ?? 0) + 1;

    const created = await axios.post(
      `${SB_URL}/rest/v1/categories`,
      { slug: 'monsoon-package', title: 'Monsoon Package', kind: 'packages', sort_order: nextOrder },
      { headers }
    );
    category = created.data[0];
    console.log(`Created category "monsoon-package" at sort_order ${nextOrder}`);
  }

  const existingPkgs = await axios.get(
    `${SB_URL}/rest/v1/packages?category_id=eq.${category.id}&select=name`,
    { headers }
  );
  const existingNames = new Set(existingPkgs.data.map((p) => p.name));

  for (let i = 0; i < PACKAGES.length; i++) {
    const p = PACKAGES[i];
    if (existingNames.has(p.name)) { console.log(`Already exists, skipping: ${p.name}`); continue; }
    await axios.post(
      `${SB_URL}/rest/v1/packages`,
      { category_id: category.id, name: p.name, price: p.price, includes: p.includes, sort_order: i },
      { headers }
    );
    console.log(`Added: ${p.name} — ৳${p.price}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FAILED:', err.response ? JSON.stringify(err.response.data) : err.message);
  process.exit(1);
});

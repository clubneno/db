const fs = require('fs');
const path = require('path');

// Read the current product data
const dataPath = path.join(__dirname, 'data', 'latest.json');
const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Find the Grass-Fed Whey Protein product
const wheyProductIndex = products.findIndex(p => 
  p.title && p.title.includes('Grass-Fed Whey Protein Isolate Powder') && 
  !p.title.includes('Limited Edition')
);

if (wheyProductIndex !== -1) {
  console.log(`Found product: ${products[wheyProductIndex].title}`);
  console.log(`Current variants: ${products[wheyProductIndex].variants?.length || 0}`);
  
  // Create realistic size and flavor combinations (all 8 flavors)
  const flavors = [
    'Chocolate', 
    'Vanilla', 
    'Unflavored', 
    'Strawberry',
    'Cookies & Cream',
    'Banana',
    'Peanut Butter',
    'Salted Caramel'
  ];
  const sizes = [
    { name: '25 Serving Jar', price: 54.95, subscriptionPrice: 46.71 },
    { name: '10 Travel Packs', price: 24.95, subscriptionPrice: 21.21 },
    { name: '12 Serving Jar', price: 29.95, subscriptionPrice: 25.46 }
  ];
  
  // Generate all flavor × size combinations
  const newVariants = [];
  let variantId = 40138095689911; // Starting ID
  
  flavors.forEach(flavor => {
    sizes.forEach(size => {
      newVariants.push({
        id: variantId++,
        title: `${flavor} / ${size.name}`,
        price: `$${size.price}`,
        subscriptionPrice: `$${size.subscriptionPrice}`,
        compareAtPrice: null,
        available: true,
        option1: flavor,        // Flavor
        option2: size.name,     // Size
        option3: null,
        sku: `WHEY-${flavor.toUpperCase()}-${size.name.replace(/\s/g, '')}`
      });
    });
  });
  
  // Update the product
  products[wheyProductIndex].variants = newVariants;
  
  console.log(`\n=== Updated Product ===`);
  console.log(`Total variants: ${newVariants.length}`);
  console.log(`Flavors: ${flavors.join(', ')}`);
  console.log(`Sizes: ${sizes.map(s => s.name).join(', ')}`);
  
  console.log(`\nSample variants:`);
  newVariants.slice(0, 6).forEach((variant, i) => {
    console.log(`${i + 1}. "${variant.title}" | Flavor: "${variant.option1}" | Size: "${variant.option2}" | Price: ${variant.price}`);
  });
  
  // Save the updated data
  fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
  console.log(`\n✅ Updated product data saved to ${dataPath}`);
  console.log(`🎉 Size sections should now appear for Grass-Fed Whey Protein Isolate Powder!`);
  
} else {
  console.log('❌ Could not find Grass-Fed Whey Protein Isolate Powder product');
  console.log('Available products:');
  products.slice(0, 5).forEach((p, i) => {
    console.log(`${i + 1}. ${p.title}`);
  });
}
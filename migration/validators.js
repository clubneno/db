/**
 * Data validation schemas for Supabase migration
 */

/**
 * Parse price string into numeric value
 */
function parsePrice(priceString) {
  if (!priceString || typeof priceString !== 'string') return null;
  
  // Remove currency symbols and extract numeric value
  const numericValue = priceString.replace(/[^\d.]/g, '');
  const parsed = parseFloat(numericValue);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Validate and transform product data
 */
function validateProduct(product) {
  const errors = [];
  const warnings = [];

  // Required fields validation
  if (!product.handle || typeof product.handle !== 'string') {
    errors.push('handle is required and must be a string');
  }

  if (!product.title || typeof product.title !== 'string') {
    errors.push('title is required and must be a string');
  }

  // Validate handle format (URL-safe)
  if (product.handle && !/^[a-z0-9-]+$/.test(product.handle)) {
    errors.push('handle must be URL-safe (lowercase letters, numbers, hyphens only)');
  }

  // Validate URLs if present
  const urlFields = ['image', 'link'];
  urlFields.forEach(field => {
    if (product[field] && !isValidUrl(product[field])) {
      warnings.push(`${field} appears to be an invalid URL`);
    }
  });

  // Validate price fields
  if (product.price) {
    const priceAmount = parsePrice(product.price);
    if (priceAmount === null) {
      warnings.push('price could not be parsed to numeric value');
    } else if (priceAmount < 0) {
      errors.push('price cannot be negative');
    }
  }

  if (product.subscriptionPrice) {
    const subPriceAmount = parsePrice(product.subscriptionPrice);
    if (subPriceAmount === null) {
      warnings.push('subscriptionPrice could not be parsed to numeric value');
    } else if (subPriceAmount < 0) {
      errors.push('subscriptionPrice cannot be negative');
    }
  }

  // Transform to Supabase schema
  const transformed = {
    handle: product.handle?.toLowerCase().trim(),
    title: product.title?.trim(),
    vendor: product.vendor?.trim() || 'Momentous',
    eu_allowed: Boolean(product.euAllowed),
    scraped_at: new Date().toISOString()
  };

  // Add optional fields with validation
  if (product.description && typeof product.description === 'string') {
    transformed.description = product.description.trim();
  }

  if (product.fullDescription && typeof product.fullDescription === 'string') {
    transformed.full_description = product.fullDescription.trim();
  }

  if (product.image && typeof product.image === 'string') {
    transformed.image = product.image.trim();
    transformed.main_image = product.image.trim();
  }

  if (product.link && typeof product.link === 'string') {
    transformed.link = product.link.trim();
  }

  if (product.category && typeof product.category === 'string') {
    transformed.category = product.category.trim();
  }

  if (product.primaryGoal && typeof product.primaryGoal === 'string') {
    transformed.primary_goal = product.primaryGoal.trim();
  }

  if (product.productType && typeof product.productType === 'string') {
    transformed.product_type = product.productType.trim();
  }

  if (product.availability && typeof product.availability === 'string') {
    transformed.availability = product.availability.trim();
  }

  // Handle price fields with separation of display and amount
  if (product.price) {
    transformed.price_display = product.price.trim();
    transformed.price_amount = parsePrice(product.price);
    transformed.price_currency = 'USD';
  }

  if (product.subscriptionPrice) {
    transformed.subscription_price_display = product.subscriptionPrice.trim();
    transformed.subscription_price_amount = parsePrice(product.subscriptionPrice);
    transformed.subscription_currency = 'USD';
  }

  // Handle JSON fields safely
  const jsonFields = ['images', 'variants', 'categories', 'goals', 'flavors', 'skus'];
  jsonFields.forEach(field => {
    if (product[field] !== undefined) {
      try {
        transformed[field] = Array.isArray(product[field]) ? product[field] : [];
      } catch (error) {
        warnings.push(`${field} is not a valid array, defaulting to empty array`);
        transformed[field] = [];
      }
    }
  });

  // Handle timestamps
  if (product.createdAt) {
    transformed.created_at = new Date(product.createdAt).toISOString();
  }

  if (product.updatedAt) {
    transformed.updated_at = new Date(product.updatedAt).toISOString();
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    data: transformed
  };
}

/**
 * Validate category data
 */
function validateCategory(category) {
  const errors = [];
  
  if (!category.name || typeof category.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  const transformed = {
    name: category.name?.trim(),
    parent_id: category.parentId || null,
    is_sub_category: Boolean(category.isSubCategory)
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
    data: transformed
  };
}

/**
 * Validate goal data
 */
function validateGoal(goal) {
  const errors = [];
  
  if (!goal.name || typeof goal.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  const transformed = {
    name: goal.name?.trim(),
    parent_id: goal.parentId || null,
    is_sub_goal: Boolean(goal.isSubGoal)
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
    data: transformed
  };
}

/**
 * Validate flavor data
 */
function validateFlavor(flavor) {
  const errors = [];
  
  if (!flavor.name || typeof flavor.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  const transformed = {
    name: flavor.name?.trim()
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
    data: transformed
  };
}

/**
 * Validate URL format
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Batch validate data with progress reporting
 */
function validateBatch(data, validator, entityType = 'item') {
  console.log(`🔍 Validating ${data.length} ${entityType}s...`);
  
  const results = {
    valid: [],
    invalid: [],
    warnings: [],
    totalErrors: 0,
    totalWarnings: 0
  };

  data.forEach((item, index) => {
    const validation = validator(item);
    
    if (validation.isValid) {
      results.valid.push(validation.data);
    } else {
      results.invalid.push({
        index,
        item,
        errors: validation.errors
      });
      results.totalErrors += validation.errors.length;
    }

    if (validation.warnings.length > 0) {
      results.warnings.push({
        index,
        warnings: validation.warnings
      });
      results.totalWarnings += validation.warnings.length;
    }
  });

  // Log validation summary
  console.log(`✅ Validation complete:`);
  console.log(`   Valid: ${results.valid.length}`);
  console.log(`   Invalid: ${results.invalid.length}`);
  console.log(`   Warnings: ${results.totalWarnings}`);

  if (results.invalid.length > 0) {
    console.log(`\n❌ Invalid ${entityType}s:`);
    results.invalid.slice(0, 5).forEach(item => {
      console.log(`   Index ${item.index}: ${item.errors.join(', ')}`);
    });
    if (results.invalid.length > 5) {
      console.log(`   ... and ${results.invalid.length - 5} more`);
    }
  }

  if (results.warnings.length > 0) {
    console.log(`\n⚠️  First few warnings:`);
    results.warnings.slice(0, 3).forEach(item => {
      console.log(`   Index ${item.index}: ${item.warnings.join(', ')}`);
    });
  }

  return results;
}

module.exports = {
  validateProduct,
  validateCategory,
  validateGoal,
  validateFlavor,
  validateBatch,
  parsePrice
};
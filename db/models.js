const { getSupabase } = require('./connection');

class ProductModel {
  static async getAllProducts(filters = {}) {
    const supabase = getSupabase();
    
    let query = supabase
      .from('products')
      .select(`
        *,
        product_images(image_url, image_order),
        product_categories(categories(name)),
        product_goals(goals(name)),
        product_variants(*),
        product_flavors(
          flavors(name),
          sku,
          hs_code,
          duty_rate,
          eu_notification_status,
          notes,
          external_link,
          ingredients
        ),
        product_tags(tags(name))
      `)
      .order('scraped_at', { ascending: false });
    
    // Apply filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%, description.ilike.%${filters.search}%`);
    }
    
    if (filters.euAllowed !== undefined) {
      query = query.eq('eu_allowed', filters.euAllowed);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Transform data to match current JSON structure
    return data.map(product => this.transformFromDB(product));
  }
  
  static async getProductByHandle(handle) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_images(image_url, image_order),
        product_categories(categories(name)),
        product_goals(goals(name)),
        product_variants(*),
        product_flavors(
          flavors(name),
          sku,
          hs_code,
          duty_rate,
          eu_notification_status,
          notes,
          external_link,
          ingredients
        ),
        product_tags(tags(name))
      `)
      .eq('handle', handle)
      .single();
    
    if (error) throw error;
    
    return this.transformFromDB(data);
  }
  
  static async updateProduct(handle, updateData) {
    const supabase = getSupabase();
    
    // Transform data for database
    const dbData = this.transformToDB(updateData);
    
    const { data, error } = await supabase
      .from('products')
      .update(dbData)
      .eq('handle', handle)
      .select()
      .single();
    
    if (error) throw error;
    
    return this.transformFromDB(data);
  }
  
  static async createProduct(productData) {
    const supabase = getSupabase();
    
    // Transform data for database
    const dbData = this.transformToDB(productData);
    
    const { data, error } = await supabase
      .from('products')
      .insert(dbData)
      .select()
      .single();
    
    if (error) throw error;
    
    return this.transformFromDB(data);
  }
  
  // Transform database row to JSON structure
  static transformFromDB(dbProduct) {
    if (!dbProduct) return null;
    
    return {
      title: dbProduct.title,
      price: dbProduct.price ? `$${dbProduct.price}` : null,
      subscriptionPrice: dbProduct.subscription_price ? `$${dbProduct.subscription_price}` : null,
      originalPrice: dbProduct.original_price ? `$${dbProduct.original_price}` : null,
      image: dbProduct.main_image,
      images: dbProduct.product_images ? 
        dbProduct.product_images
          .sort((a, b) => a.image_order - b.image_order)
          .map(img => img.image_url) : [],
      link: dbProduct.link,
      handle: dbProduct.handle,
      description: dbProduct.description,
      fullDescription: dbProduct.full_description,
      categories: dbProduct.product_categories ? 
        dbProduct.product_categories.map(pc => pc.categories.name) : [],
      category: dbProduct.category,
      goals: dbProduct.product_goals ? 
        dbProduct.product_goals.map(pg => pg.goals.name) : [],
      primaryGoal: dbProduct.primary_goal,
      productType: dbProduct.product_type,
      vendor: dbProduct.vendor,
      availability: dbProduct.availability,
      tags: dbProduct.product_tags ? 
        dbProduct.product_tags.map(pt => pt.tags.name) : [],
      tagsString: dbProduct.tags_string,
      benefits: dbProduct.benefits,
      ingredients: dbProduct.ingredients,
      usage: dbProduct.usage,
      rating: dbProduct.rating ? dbProduct.rating.toString() : null,
      reviewsCount: dbProduct.reviews_count,
      createdAt: dbProduct.created_at,
      updatedAt: dbProduct.updated_at,
      scraped_at: dbProduct.scraped_at,
      variants: dbProduct.product_variants || [],
      
      // Business fields
      euNotificationStatus: dbProduct.eu_notification_status,
      euAllowed: dbProduct.eu_allowed,
      flavors: dbProduct.product_flavors ? 
        dbProduct.product_flavors.map(pf => pf.flavors.name) : [],
      skus: dbProduct.product_flavors ? 
        dbProduct.product_flavors.reduce((acc, pf) => {
          acc[pf.flavors.name] = pf.sku;
          return acc;
        }, {}) : {},
      hsCode: dbProduct.hs_code,
      hsCodeDescription: dbProduct.hs_code_description,
      dutyRate: dbProduct.duty_rate,
      size: dbProduct.size,
      servings: dbProduct.servings,
      intakeFrequency: dbProduct.intake_frequency,
      reorderPeriod: dbProduct.reorder_period,
      nutraceuticalsRegularPrice: dbProduct.nutraceuticals_regular_price,
      nutraceuticalsSubscriptionPrice: dbProduct.nutraceuticals_subscription_price,
      clubnenoRegularPrice: dbProduct.clubneno_regular_price,
      clubnenoSubscriptionPrice: dbProduct.clubneno_subscription_price,
      
      // Flavor-specific data
      flavorSkus: dbProduct.product_flavors ? 
        dbProduct.product_flavors.reduce((acc, pf) => {
          acc[pf.flavors.name] = pf.sku;
          return acc;
        }, {}) : {},
      flavorHsCodes: dbProduct.product_flavors ? 
        dbProduct.product_flavors.reduce((acc, pf) => {
          acc[pf.flavors.name] = pf.hs_code;
          return acc;
        }, {}) : {},
      flavorDutyRates: dbProduct.product_flavors ? 
        dbProduct.product_flavors.reduce((acc, pf) => {
          acc[pf.flavors.name] = pf.duty_rate;
          return acc;
        }, {}) : {},
      flavorEuNotifications: dbProduct.product_flavors ? 
        dbProduct.product_flavors.reduce((acc, pf) => {
          acc[pf.flavors.name] = pf.eu_notification_status;
          return acc;
        }, {}) : {},
      flavorNotes: dbProduct.product_flavors ? 
        dbProduct.product_flavors.reduce((acc, pf) => {
          acc[pf.flavors.name] = pf.notes;
          return acc;
        }, {}) : {},
      flavorLinks: dbProduct.product_flavors ? 
        dbProduct.product_flavors.reduce((acc, pf) => {
          acc[pf.flavors.name] = pf.external_link;
          return acc;
        }, {}) : {},
      flavorIngredients: dbProduct.product_flavors ? 
        dbProduct.product_flavors.reduce((acc, pf) => {
          acc[pf.flavors.name] = pf.ingredients;
          return acc;
        }, {}) : {}
    };
  }
  
  // Transform JSON structure to database format
  static transformToDB(jsonProduct) {
    const extractPrice = (priceString) => {
      if (!priceString) return null;
      const matches = priceString.match(/[\d,]+\.?\d*/);
      return matches ? parseFloat(matches[0].replace(',', '')) : null;
    };
    
    return {
      title: jsonProduct.title,
      handle: jsonProduct.handle,
      price: extractPrice(jsonProduct.price),
      subscription_price: extractPrice(jsonProduct.subscriptionPrice),
      original_price: extractPrice(jsonProduct.originalPrice),
      main_image: jsonProduct.image,
      link: jsonProduct.link,
      description: jsonProduct.description,
      full_description: jsonProduct.fullDescription,
      category: jsonProduct.category,
      primary_goal: jsonProduct.primaryGoal,
      product_type: jsonProduct.productType,
      vendor: jsonProduct.vendor,
      availability: jsonProduct.availability,
      tags_string: jsonProduct.tagsString,
      benefits: jsonProduct.benefits,
      ingredients: jsonProduct.ingredients,
      usage: jsonProduct.usage,
      rating: jsonProduct.rating ? parseFloat(jsonProduct.rating) : null,
      reviews_count: jsonProduct.reviewsCount || 0,
      created_at: jsonProduct.createdAt,
      updated_at: jsonProduct.updatedAt,
      scraped_at: jsonProduct.scraped_at || new Date().toISOString(),
      
      // Business fields
      eu_notification_status: jsonProduct.euNotificationStatus,
      eu_allowed: jsonProduct.euAllowed,
      hs_code: jsonProduct.hsCode,
      hs_code_description: jsonProduct.hsCodeDescription,
      duty_rate: jsonProduct.dutyRate,
      size: jsonProduct.size,
      servings: jsonProduct.servings,
      intake_frequency: jsonProduct.intakeFrequency,
      reorder_period: jsonProduct.reorderPeriod,
      nutraceuticals_regular_price: jsonProduct.nutraceuticalsRegularPrice,
      nutraceuticals_subscription_price: jsonProduct.nutraceuticalsSubscriptionPrice,
      clubneno_regular_price: jsonProduct.clubnenoRegularPrice,
      clubneno_subscription_price: jsonProduct.clubnenoSubscriptionPrice
    };
  }
}

// Categories Model
class CategoryModel {
  static async getAll() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  }
  
  static async create(name) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('categories')
      .insert({ name })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  static async delete(name) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('name', name);
    
    if (error) throw error;
  }
}

// Goals Model
class GoalModel {
  static async getAll() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  }
  
  static async create(name) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('goals')
      .insert({ name })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  static async delete(name) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('name', name);
    
    if (error) throw error;
  }
}

// Flavors Model
class FlavorModel {
  static async getAll() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('flavors')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  }
  
  static async create(name) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('flavors')
      .insert({ name })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  static async delete(name) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('flavors')
      .delete()
      .eq('name', name);
    
    if (error) throw error;
  }
}

module.exports = {
  ProductModel,
  CategoryModel,
  GoalModel,
  FlavorModel
};
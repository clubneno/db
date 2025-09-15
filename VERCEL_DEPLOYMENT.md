# Vercel Deployment Instructions

## Step 1: Set Environment Variables in Vercel

Go to your Vercel dashboard and add these environment variables:

```
SUPABASE_URL=https://baqdzabfkhtgnxzhoyax.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iywicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTY5ODksImV4cCI6MjA3MzQ5Mjk4OX0.oKGG5wAo6gWBPWM8dj-BvqVv0bG1Vs8jj3DFV5lPUk4
NODE_ENV=production
```

## Step 2: Deploy

Push your changes to your git repository, and Vercel will automatically redeploy.

## Step 3: Test

After deployment, your app should now:
- Show data from Supabase database after authentication
- No longer show "Please run the scraper first" error
- Display all 64+ products properly

## Current Status

✅ Database Schema Applied
✅ Data Migrated (64/67 products)
✅ API Endpoints Updated
⏳ Environment Variables Need to be Set in Vercel

The error you're seeing means the Vercel deployment doesn't have the Supabase environment variables set, so it's falling back to the old JSON file system.
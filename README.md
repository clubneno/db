# Momentous Product Scraper & Analysis Tool

A beautiful web-based tool for scraping and analyzing Momentous supplement products.

## Features

### 🕷️ Web Scraper
- Scrapes product data from Momentous website
- Extracts comprehensive product information:
  - Names, prices, descriptions
  - Product images and links
  - Categories and availability
  - Ingredients, benefits, and usage instructions
- Handles pagination and dynamic loading
- Respectful scraping with delays

### 📊 Analysis Dashboard
- **Analytics Overview**: Total products, average price, price ranges, categories
- **Interactive Charts**: Price distribution and category breakdown
- **Advanced Filtering**: Search, category filter, price range, sorting
- **Responsive Design**: Works on desktop and mobile devices

### 🎨 Beautiful Interface
- Modern, clean design with Tailwind CSS
- Real-time data visualization with Chart.js
- Responsive grid layout for products
- Loading states and error handling

## Installation

1. **Clone/Navigate to the project:**
```bash
cd momentous-scraper
```

2. **Install dependencies:**
```bash
npm install
```

## Usage

### 1. Run the Scraper
```bash
npm run scrape
```
This will:
- Launch a browser instance
- Navigate to Momentous shop page
- Scrape all product information
- Save data to `data/latest.json`

### 2. Start the Analysis Dashboard
```bash
npm start
```
Visit `http://localhost:3000` to view the analysis tool.

### 3. Development Mode
```bash
npm run dev
```
Starts the server with nodemon for automatic restarts.

## API Endpoints

- `GET /api/products` - Get filtered products
  - Query params: `search`, `category`, `minPrice`, `maxPrice`, `sortBy`
- `GET /api/analytics` - Get product analytics and statistics

## Project Structure

```
momentous-scraper/
├── scraper.js          # Main scraping logic
├── server.js           # Express API server
├── package.json        # Dependencies and scripts
├── data/               # Scraped product data
│   └── latest.json     # Most recent scrape data
└── public/             # Web interface
    ├── index.html      # Main dashboard
    └── app.js          # Frontend JavaScript
```

## Technical Details

### Scraper Features
- Uses Puppeteer for browser automation
- Handles dynamic content loading
- Extracts detailed product information
- Respectful scraping with delays
- Error handling and recovery

### Dashboard Features
- Real-time filtering and search
- Interactive data visualizations
- Responsive design
- REST API integration

## Dependencies

- **puppeteer**: Web scraping browser automation
- **express**: Web server framework
- **cheerio**: Server-side HTML parsing
- **chart.js**: Data visualization
- **tailwindcss**: Utility-first CSS framework
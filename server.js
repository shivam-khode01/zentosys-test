#!/usr/bin/env node

/**
 * Weather CLI Tool - A command-line tool to fetch and display weather information.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { program } = require('commander');

// Configuration
const API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY'; // Replace with your API key
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';
const CACHE_FILE = path.join(os.homedir(), '.weather_cache.json');
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Load the cache from file if it exists.
 * @returns {Object} The cached data
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.error('Error reading cache file:', error.message);
  }
  return {};
}

/**
 * Save the cache to file.
 * @param {Object} cache - The cache data to save
 */
function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing cache file:', error.message);
  }
}

/**
 * Make an HTTP request to the OpenWeatherMap API.
 * @param {string} url - The URL to fetch
 * @returns {Promise<Object>} The parsed JSON response
 */
function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Request failed with status code ${response.statusCode}`));
        response.resume(); // Consume response data to free up memory
        return;
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (error) {
          reject(new Error('Error parsing JSON response'));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Fetch weather data for the given city.
 * @param {string} city - The city name
 * @returns {Promise<Object>} The weather data
 */
async function getWeather(city) {
  const cache = loadCache();
  const currentTime = Date.now();
  
  // Check if we have a valid cached result
  const cacheKey = city.toLowerCase();
  if (cache[cacheKey]) {
    const cachedData = cache[cacheKey];
    if (currentTime - cachedData.timestamp < CACHE_EXPIRY) {
      console.log(`Using cached data from ${new Date(cachedData.timestamp).toLocaleString()}`);
      return cachedData.data;
    }
  }
  
  // If no valid cache, fetch from API
  const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
  
  try {
    const data = await fetchData(url);
    
    // Update cache
    cache[cacheKey] = {
      timestamp: currentTime,
      data: data
    };
    saveCache(cache);
    
    return data;
  } catch (error) {
    if (error.message.includes('404')) {
      console.error(`Error: City '${city}' not found.`);
    } else if (error.message.includes('401')) {
      console.error('Error: Invalid API key. Please update your API key.');
    } else {
      console.error(`Error connecting to weather service: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Display weather information in a user-friendly format.
 * @param {Object} data - The weather data
 */
function displayWeather(data) {
  const cityName = data.name;
  const country = data.sys.country;
  const temp = data.main.temp;
  const feelsLike = data.main.feels_like;
  const description = data.weather[0].description;
  const windSpeed = data.wind.speed;
  const windDirection = data.wind.deg;
  const humidity = data.main.humidity;
  const pressure = data.main.pressure;
  
  // Convert wind direction to cardinal direction
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(windDirection / 45) % 8;
  const cardinalDirection = directions[index];
  
  // Format output
  console.log(`\nWeather for ${cityName}, ${country}`);
  console.log('='.repeat(40));
  console.log(`Temperature: ${temp}°C (Feels like: ${feelsLike}°C)`);
  console.log(`Condition: ${capitalizeFirstLetter(description)}`);
  console.log(`Wind: ${windSpeed} m/s, ${cardinalDirection} (${windDirection}°)`);
  console.log(`Humidity: ${humidity}%`);
  console.log(`Pressure: ${pressure} hPa`);
  
  // Add weather icon/symbol based on condition
  const weatherId = data.weather[0].id;
  let symbol = '';
  
  if (weatherId >= 200 && weatherId < 300) {
    symbol = '⚡'; // Thunderstorm
  } else if (weatherId >= 300 && weatherId < 400) {
    symbol = '🌦'; // Drizzle
  } else if (weatherId >= 500 && weatherId < 600) {
    symbol = '🌧'; // Rain
  } else if (weatherId >= 600 && weatherId < 700) {
    symbol = '❄'; // Snow
  } else if (weatherId >= 700 && weatherId < 800) {
    symbol = '🌫'; // Atmosphere (fog, mist, etc.)
  } else if (weatherId === 800) {
    symbol = '☀'; // Clear
  } else {
    symbol = '☁'; // Clouds
  }
  
  console.log(`\nCurrent weather: ${symbol} ${capitalizeFirstLetter(description)}`);
}

/**
 * Capitalize the first letter of each word in a string.
 * @param {string} str - The input string
 * @returns {string} The capitalized string
 */
function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Clear the cached weather data.
 */
function clearCache() {
  if (fs.existsSync(CACHE_FILE)) {
    fs.unlinkSync(CACHE_FILE);
    console.log('Cache cleared successfully.');
  } else {
    console.log('No cache file found.');
  }
}

/**
 * Main function to run the CLI.
 */
function main() {
  program
    .name('weather')
    .description('Command-line weather information tool')
    .version('1.0.0');
  
  program
    .argument('[city]', 'City name to get weather information for')
    .option('--clear-cache', 'Clear cached weather data')
    .action(async (city, options) => {
      if (options.clearCache) {
        clearCache();
        return;
      }
      
      if (!city) {
        program.help();
        return;
      }
      
      if (API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
        console.error('Error: API key not configured. Please update the API_KEY variable in the script.');
        console.error('You can get a free API key from https://openweathermap.org/api');
        process.exit(1);
      }
      
      const weatherData = await getWeather(city);
      displayWeather(weatherData);
    });
  
  program.parse(process.argv);
}

main();
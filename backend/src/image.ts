import { Contestant, SearXNG } from './types'
import { config } from './config'
import Imgproxy from 'imgproxy'
import * as fs from 'fs'

/**
 * Get image URL from SearxNG and filter for big images (400x400 or larger)
 * @param topic The search query
 * @returns An array of image URLs
 */
export const getImageURLs = async (topic: string): Promise<string[]> => {
  // If no topic or SearxNG host is defined, return an empty array
  if (!topic || !config.searxngHost) {
    return []
  }

  try {
    // Fetch images from SearxNG
    const result = await fetch(`https://${config.searxngHost}/search?q=${topic}&categories=images&format=json&safe_search=2`);
    
    // Parse the JSON response
    const data = await result.json() as SearXNG

    // Evaluate all conditions asynchronously
    const checks = await Promise.all(
      // Check each image
      data.results.map(async (image) => {
        // Discard results without main or thumbnail image
        if (!image.img_src) return false
        
        // Check if the image has a resolution
        if (!image.resolution) return false
        
        // Check if the image is big enough
        const [w, h] = image.resolution.split('x').map(Number)
        
        // Check if the image is at least 400x400
        if (isNaN(w) || isNaN(h) || h < 400 || w < 400) return false

        // If all checks pass, return true
        return true
      })
    )

    // Filter based on the resolved checks
    const goodImages = data.results
      // Filter out images that don't pass the checks
      .filter((_, index) => checks[index])
      // Get the URL of the images
      .map(image => (proxyImageUrl(image.img_src)))

    // Return the filtered image URLs
    return goodImages;
  } catch (error) {
    return []
  }
}

/**
 * Save an image from a URL to the file system
 * @param contestant The contestant object
 * @param bracket The bracket ID
 */
export const saveImage = async (contestant: Contestant, bracket: number | bigint): Promise<string | undefined> => {
  // try-catch block to handle errors
  try {
    // Fetch the image URL
    const url = contestant.image_url
    const response = await (await fetch(url)).arrayBuffer()
    
    // Define image path and file name (png). Remove all non-alphanumeric characters from name
    const path = `${config.dataPath}/images`
    const name = `${bracket}_${contestant.name.replace(/[^a-z0-9]/gi, '')}.png`
  
    // Save the image to path
    fs.writeFileSync(`${path}/${name}`, Buffer.from(response))
    
    // Return the image path
    return `/data/images/${name}`
  } catch (error) {
    console.error(`Error saving image: ${error}`)
  }
}

/**
 * Proxy an image URL through imgproxy
 * @param url The image URL
 * @returns The proxied image URL, as PNG and resized to 400x400
 */
const proxyImageUrl = (url: string) => {
  // Check if the URL starts with a protocol
  const prefix = url.startsWith('//') ? 'https:' : ''
  const fullUrl = `${prefix}${url}`
  
  // Instantiate the Imgproxy object
  const imgproxy = new Imgproxy({
    baseUrl: `https://${config.imgProxyHost}`,
    key: config.imgProxyKey,
    salt: config.imgProxySalt,
    encode: true
  })
  
  // Generate the imgproxy URL
  const imgproxyUrl = imgproxy.builder()
    .resize('fill-down', 400, 400)
    .format('png')
    .generateUrl(fullUrl)
  
  // Return the proxied image URL, with the added protocol and resized to 400x400
  return imgproxyUrl
}
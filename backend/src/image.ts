import { Jimp } from 'jimp'
import { Contestant, SearXNG } from './types'
import { config } from './config'

/**
 * Get image URL from SearxNG and filter for big square images (400x400 or larger)
 * @param topic The search query
 * @returns An array of image URLs
 */
export const getImageURL = async (topic: string): Promise<{ url: string }[]> => {
  if (!topic || !config.searxngHost) {
    return []
  }

  try {
    const result = await fetch(`https://${config.searxngHost}/search?q=${topic}&categories=images&format=json`);
    const data = await result.json() as SearXNG

    // Evaluate all conditions asynchronously
    const checks = await Promise.all(
      data.results.map(async (image) => {
        // Check if the image has a resolution
        if (!image.resolution) return false
        
        // Check if the image is a big square image
        const [w, h] = image.resolution.split('x').map(Number)
        if (isNaN(w) || isNaN(h) || w !== h || w < 400) return false
        
        // Check if the image is accessible
        const prefix = image.img_src.startsWith('//') ? 'https:' : ''
        const fetchResult = await fetch(`${prefix}${image.img_src}`)
        if (!fetchResult.ok) {
          console.error(`Error getting image from ${image.img_src}:\n${fetchResult.statusText}`)
          return false
        }
        return true
      })
    )

    // Filter based on the resolved checks
    const bigSquareImages = data.results
      // Filter out images that don't pass the checks
      .filter((_, index) => checks[index])
      // Sort images by score
      .sort((a, b) => b.score - a.score)
      // Get the URL of the images
      .map(image => ({ url: image.img_src }))

    // Return the filtered image URLs
    return bigSquareImages;
  } catch (error) {
    console.error(`Error getting image URL: ${error}`)
    return []
  }
}

/**
 * Save an image from a URL to the file system
 * @param contestant The contestant object
 * @param bracket The bracket ID
 */
export const saveImage = async (contestant: Contestant, bracket: number | bigint) => {
  // try-catch block to handle errors
  try {    
    // Read image and convert to 400x400
    const prefix = contestant.image_url.startsWith('//') ? 'https:' : ''
    const image = await Jimp.read(`${prefix}${contestant.image_url}`)
    
    // Resize image to 400x400
    image.resize({ w: 400, h: 400 })
  
    // Define image path and file name (png). Remove all non-alphanumeric characters from name
    const path = `${config.dataPath}/images`
    const name = `${bracket}_${contestant.name.replace(/[^a-z0-9]/gi, '')}`
    const ext = 'png'
  
    // Save the image to path
    await image.write(`${path}/${name}.${ext}`)
  } catch (error) {
    console.error(`Error saving image: ${error}`)
  }
}
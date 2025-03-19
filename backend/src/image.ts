import { Jimp } from 'jimp'
import { Contestant, SearXNG } from './types'
import { config } from './config'

/**
 * Get image URL from SearxNG and filter for big square images (400x400 or larger)
 * @param topic The search query
 * @returns An array of image URLs
 */
export const getImageURL = async (topic: string): Promise<{ url: string }[]> => {
  // Check if topic and searxngHost are defined
  if (!topic || !config.searxngHost) {
    return []
  }
  
  // try-catch block to handle errors
  try {
    // Get result from SearxNG
    const result = await fetch(`https://${config.searxngHost}/search?q=${topic}&categories=images&format=json`)
    const data = await result.json() as SearXNG
  
    const bigSquareImages = data.results.filter(async (image) => {
      // Check if image has a resolution
      if (!image.resolution)
        return false
      
      // Get image resolution. This handles strings like '500x500' or '500 x 500'
      const [w, h] = image.resolution.split('x').map(Number)
      
      // Check if image is square and at least 400x400
      const square = w === h
      const big = w >= 400
      
      if (!square || !big) return false
      
      // Check if image is accessible
      const prefix = image.img_src.startsWith('//') ? 'https:' : ''
      const result = await fetch(`${prefix}${image.img_src}`)
      
      if (!result.ok)
        console.error(`Error getting image from ${image.img_src}:\n${result.statusText}`)
      
      // Return true if image is accessible
      return result.ok
    }).map((image) => ({ url: image.img_src }))
  
    return bigSquareImages
  } catch (error) {
    // Log error and return empty array
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
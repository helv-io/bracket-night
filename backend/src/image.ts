import { Jimp } from 'jimp'
import { Contestant, SearXNG } from './types'
import { config } from './config'

// Create a new bracket with 16 contestants
export const getImageURL = async (topic: string): Promise<{ url: string }[]> => {
  // Check if topic and searxngHost are defined
  if (!topic || !config.searxngHost) {
    return []
  }
  
  // try-catch block to handle errors
  try {
    // Get result from SearxNG
    const result = await fetch(`${config.searxngHost}/search?q=${topic}&categories=images&format=json`)
    const data = await result.json() as SearXNG
  
    const bigSquareImages = data.results.filter((image) => {
      // Check if image has a resolution
      if (!image.resolution)
        return false
      
      // Get image resolution. This handles strings like '500x500' or '500 x 500'
      const [w, h] = image.resolution.split('x').map(Number)
      
      // Only return images that are square and at least 400x400
      return w === h && w >= 400
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
 * @param url The URL of the image
 * @param contestant The contestant object
 * @returns The path of the saved image
 */
export const saveImage = async (contestant: Contestant, bracket: number | bigint, index: number) => {
  // try-catch block to handle errors
  try {    
    // Read image and convert to 400x400
    const image = await Jimp.read(contestant.image_url)
    console.log(image)
    
    // Resize image to 400x400
    image.resize({ w: 400, h: 400 })
    console.log(image)
  
    // Define image path and file name (png)
    const path = `${config.dataPath}/images`
    const name = `${bracket}_${index}`
    const ext = 'png'
    console.log(`${path}/${name}.${ext}`)
  
    // Save the image to path
    await image.write(`${path}/${name}.${ext}`)
  } catch (error) {
    console.error(`Error saving image: ${error}`)
  }
}
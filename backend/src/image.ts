import gis from 'async-g-i-s'
import { Jimp } from 'jimp'
import { Contestant } from './types'
import { config } from './config'

// Create a new bracket with 16 contestants
export const getImageURL = async (topic: string, choice: number): Promise<{ url: string, choice: number } | undefined> => {
  // Get images from Google Image Search
  const images = await gis(topic)  
  
  // If there are images
  if (images.length) {
    // Filter out images that are not square and not big enough
    const bigSquareImages = images.filter(i => i.height === i.width && i.height >= 400)
    
    // Return the URL of the chosen image
    if (bigSquareImages.length) {
      // Make sure choice is within bounds, never below 0
      const i = Math.min(choice, bigSquareImages.length - 1) < 0 ? 0 : Math.min(choice, bigSquareImages.length - 1)
      
      // Return the URL
      return { url: bigSquareImages[i].url, choice: i }
    }
    
    // No images
    return undefined
  }
  // No images
  return undefined
}

/**
 * Save an image from a URL to the file system
 * @param url The URL of the image
 * @param contestant The contestant object
 * @returns The path of the saved image
 */
export const saveImage = async (contestant: Contestant) => {
  // try-catch block to handle errors
  try {
    // Read image and convert to 400x400 PNG
    const image = await Jimp.read(contestant.image_url)
    image.resize({ w: 400, h: 400 })
  
    // Define image path
    const path = `${config.dataPath}/images`
    const fileName = `${contestant.bracket_id}_${contestant.id}`
    const extention = 'png'
  
    // Save the image to path
    await image.write(`${path}/${fileName}.${extention}`)
  } catch (error) {
    console.error(`Error saving image: ${error}`)
  }
}
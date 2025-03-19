import gis from 'async-g-i-s'
import { Jimp } from 'jimp'
import { Contestant } from './types'
import { config } from './config'

// Create a new bracket with 16 contestants
export const getImageURL = async (topic: string): Promise<{ url: string }[]> => {
  // Get images from Google Image Search
  const images = await gis(topic)  
  
  // If there are images
  if (images.length) {
    // Filter out images that are not square and not big enough
    return images.filter(i => i.height === i.width && i.height >= 400)
  }
  // No images
  return []
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
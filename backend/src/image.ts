import { Jimp } from 'jimp'
import { Contestant, SearXNG } from './types'
import { config } from './config'

/**
 * Get image URL from SearxNG and filter for big square images (400x400 or larger)
 * @param topic The search query
 * @returns An array of image URLs
 */
export const getImageURLs = async (topic: string): Promise<{ url: string, thumb: string }[]> => {
  if (!topic || !config.searxngHost) {
    return []
  }

  try {
    const result = await fetch(`https://${config.searxngHost}/search?q=${topic}&categories=images&format=json`);
    const data = await result.json() as SearXNG

    // Evaluate all conditions asynchronously
    const checks = await Promise.all(
      data.results.map(async (image) => {
        // Discard results without main or thumbnail image
        if (!image.img_src || !image.thumbnail_src) return false
        
        // Check if the image has a resolution
        if (!image.resolution) return false
        
        // Check if the image is a big square image
        const [w, h] = image.resolution.split('x').map(Number)
        if (isNaN(w) || isNaN(h) || w !== h || w < 400) return false
        
        // Check if the image is accessible
        const prefixMain = image.img_src.startsWith('//') ? 'https:' : ''
        const fetchMain = await fetch(`${prefixMain}${image.img_src}`)
        if (!fetchMain.ok) {
          return false
        }
        
        // Check if the thumbnail is accessible
        const prefixThumb = image.thumbnail_src.startsWith('//') ? 'https:' : ''
        const fetchThumb = await fetch(`${prefixThumb}${image.thumbnail_src}`)
        if (!fetchThumb.ok) {
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
      .map(image => ({ url: image.img_src, thumb: image.thumbnail_src || image.img_src }))

    // Return the filtered image URLs
    return bigSquareImages;
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
    
    // Return the image path
    return `/data/images/${name}.${ext}`
  } catch (error) {
    console.error(`Error saving image: ${error}`)
  }
}
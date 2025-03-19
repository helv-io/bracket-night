import gis from 'async-g-i-s'

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

// TODO: Add a function that fetches images from Google Image Search
//       Convert them to 400x400px PNGs
//       Save them to the filesystem so they can be used in the bracket
//       Format: /app/data/images/<bracket_id>/<contestant_id>.png
//       <img> Fallback to Public URLs if the image is not found
import gis from 'async-g-i-s'

// Create a new bracket with 16 contestants
export async function getImageURL(topic: string, choice: number): Promise<string> {
  // Get images from Google Image Search
  const images = await gis(topic)  
  
  // If there are images
  if (images.length) {
    // Filter out images that are not square and not big enough
    const bigSquareImages = images.filter(i => i.height === i.width && i.height >= 200)
    
    // Return the URL of the chosen image
    if (bigSquareImages.length) {
      // Make sure choice is within bounds, never below 0
      const i = Math.min(choice, bigSquareImages.length - 1) < 0 ? 0 : Math.min(choice, bigSquareImages.length - 1)
      
      // Return the URL
      return bigSquareImages[i].url
    }
    
    // No images
    return ''
  }
  // No images
  return ''
}
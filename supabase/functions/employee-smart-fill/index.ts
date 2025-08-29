const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SmartFillRequest {
  text: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { text }: SmartFillRequest = await req.json()

    console.log('Processing smart fill for text length:', text.length)

    const lowercaseText = text.toLowerCase()
    const result: any = {}

    // Extract email
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    if (emailMatch) {
      result.email = emailMatch[0]
    }

    // Extract phone (Indian 10-digit pattern)
    const phoneMatch = text.match(/(?:\+91[-\s]?)?[6789]\d{9}/g)
    if (phoneMatch) {
      result.phone = phoneMatch[0].replace(/[^\d]/g, '').slice(-10)
    }

    // Extract DOB (dd/mm/yyyy or yyyy-mm-dd)
    const dobMatch = text.match(/\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/)
    if (dobMatch) {
      result.dob = dobMatch[0]
    }

    // Extract name from "Name:" pattern or first words
    let nameMatch = text.match(/name\s*:?\s*([^\n\r]{2,50})/i)
    if (!nameMatch) {
      // Try first meaningful words
      const words = text.trim().split(/\s+/).filter(w => w.length > 1)
      if (words.length >= 2) {
        nameMatch = [null, `${words[0]} ${words[1]}`]
      }
    }
    
    if (nameMatch) {
      const fullName = nameMatch[1].trim()
      const nameParts = fullName.split(/\s+/)
      if (nameParts.length >= 2) {
        result.first_name = nameParts[0]
        result.last_name = nameParts.slice(1).join(' ')
      } else {
        result.first_name = nameParts[0]
      }
    }

    // Extract gender
    if (lowercaseText.includes('female')) {
      result.gender = 'Female'
    } else if (lowercaseText.includes('male')) {
      result.gender = 'Male'
    }

    // Extract department by keywords
    const departments = [
      { keywords: ['digital', 'online', 'social media', 'seo', 'marketing'], value: 'Digital' },
      { keywords: ['film', 'movie', 'cinema', 'production'], value: 'Film Events' },
      { keywords: ['utsav', 'festival', 'cultural'], value: 'Utsav Events' },
      { keywords: ['corporate', 'corp', 'business'], value: 'Corp Events' },
      { keywords: ['finance', 'accounts', 'accounting', 'financial'], value: 'Finance' },
      { keywords: ['housekeeping', 'cleaning', 'maintenance'], value: 'Housekeeping' },
      { keywords: ['admin', 'administration', 'it', 'technical', 'computer'], value: 'Admin/IT' },
      { keywords: ['creative', 'design', 'graphics', 'content'], value: 'Creative' },
      { keywords: ['manager', 'management', 'lead', 'head'], value: 'Managerial' }
    ]

    for (const dept of departments) {
      if (dept.keywords.some(keyword => lowercaseText.includes(keyword))) {
        result.department = dept.value
        break
      }
    }

    // Extract designation
    const designationPatterns = [
      /designation\s*:?\s*([^\n\r]{2,50})/i,
      /role\s*:?\s*([^\n\r]{2,50})/i,
      /title\s*:?\s*([^\n\r]{2,50})/i,
      /position\s*:?\s*([^\n\r]{2,50})/i
    ]

    for (const pattern of designationPatterns) {
      const match = text.match(pattern)
      if (match) {
        result.designation = match[1].trim()
        break
      }
    }

    console.log('Smart fill result:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in smart fill:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
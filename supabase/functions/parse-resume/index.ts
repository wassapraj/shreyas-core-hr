
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParseResumeRequest {
  text?: string
  fileBase64?: string
  filename?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { text, fileBase64, filename }: ParseResumeRequest = await req.json()
    
    let resumeText = text || ''
    
    // If file provided, extract text (basic implementation)
    if (fileBase64 && filename) {
      try {
        const buffer = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0))
        const textDecoder = new TextDecoder()
        
        if (filename.toLowerCase().endsWith('.txt')) {
          resumeText = textDecoder.decode(buffer)
        } else {
          // For PDF/DOCX, try to extract as text (simplified approach)
          resumeText = textDecoder.decode(buffer)
        }
      } catch (error) {
        console.error('File parsing error:', error)
      }
    }

    if (!resumeText) {
      return new Response(
        JSON.stringify({ error: 'No text content found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const lowerText = resumeText.toLowerCase()
    const result: any = {}

    // Extract name (first two words near "name:")
    const nameMatch = lowerText.match(/name[:\s]*([a-z\s]+)/i)
    if (nameMatch) {
      const nameParts = nameMatch[1].trim().split(/\s+/).slice(0, 2)
      if (nameParts.length > 0) result.first_name = nameParts[0]
      if (nameParts.length > 1) result.last_name = nameParts[1]
    }

    // Extract email
    const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
    if (emailMatch) result.email = emailMatch[0]

    // Extract phone (10 digits)
    const phoneMatch = resumeText.match(/(?:\+91\s?)?[6-9]\d{9}/g)
    if (phoneMatch) result.phone = phoneMatch[0].replace(/\D/g, '').slice(-10)

    // Extract date of birth
    const dobMatch = resumeText.match(/(?:dob|date of birth|born)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i)
    if (dobMatch) {
      const dateStr = dobMatch[1]
      // Convert to yyyy-mm-dd format
      if (dateStr.includes('/') || dateStr.includes('-')) {
        const parts = dateStr.split(/[-\/]/)
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // yyyy-mm-dd or yyyy/mm/dd
            result.dob = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
          } else {
            // dd-mm-yyyy or dd/mm/yyyy
            result.dob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
          }
        }
      }
    }

    // Extract gender
    const genderMatch = lowerText.match(/gender[:\s]*(male|female)/i)
    if (genderMatch) result.gender = genderMatch[1].charAt(0).toUpperCase() + genderMatch[1].slice(1).toLowerCase()

    // Extract designation/title/role
    const designationMatch = lowerText.match(/(?:designation|title|role|position)[:\s]*([a-z\s]+)/i)
    if (designationMatch) {
      result.designation = designationMatch[1].trim().replace(/\n.*/, '').substring(0, 50)
    }

    // Department guess by keywords
    if (lowerText.includes('digital') || lowerText.includes('software') || lowerText.includes('developer')) {
      result.department = 'Digital'
    } else if (lowerText.includes('finance') || lowerText.includes('accounting')) {
      result.department = 'Finance'
    } else if (lowerText.includes('creative') || lowerText.includes('design')) {
      result.department = 'Creative'
    } else if (lowerText.includes('event') || lowerText.includes('marketing')) {
      result.department = 'Events'
    } else if (lowerText.includes('housekeeping') || lowerText.includes('maintenance')) {
      result.department = 'Housekeeping'
    } else if (lowerText.includes('admin') || lowerText.includes('hr')) {
      result.department = 'Administration'
    } else if (lowerText.includes('manager') || lowerText.includes('management')) {
      result.department = 'Management'
    }

    // Location (common city names)
    const cities = ['mumbai', 'delhi', 'bangalore', 'chennai', 'hyderabad', 'pune', 'kolkata', 'ahmedabad', 'jaipur', 'lucknow']
    for (const city of cities) {
      if (lowerText.includes(city)) {
        result.location = city.charAt(0).toUpperCase() + city.slice(1)
        break
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error parsing resume:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

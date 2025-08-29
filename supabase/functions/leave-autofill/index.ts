import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawText } = await req.json();
    
    if (!rawText) {
      throw new Error('rawText is required');
    }

    console.log('Processing leave autofill for text:', rawText);

    const text = rawText.toLowerCase();
    
    // Determine leave type based on keywords
    let type = 'CL'; // default
    
    const sickKeywords = ['sick', 'fever', 'doctor', 'ill', 'covid', 'health', 'medical', 'hospital', 'medicine', 'unwell'];
    const casualKeywords = ['casual', 'personal', 'travel', 'function', 'marriage', 'festival', 'wedding', 'family', 'urgent'];
    
    if (sickKeywords.some(keyword => text.includes(keyword))) {
      type = 'SL';
    } else if (casualKeywords.some(keyword => text.includes(keyword))) {
      type = 'CL';
    } else {
      type = 'EL'; // earned leave as fallback
    }

    // Parse dates - try multiple patterns
    let startDate = null;
    let endDate = null;
    let reason = rawText;

    // Pattern 1: "from <d> <mon?> <yy?> to <d> <mon?> <yy?>"
    const fromToPattern = /from\s+(\d{1,2})\s*(?:(\w+)\s*)?(?:(\d{2,4})\s*)?to\s+(\d{1,2})\s*(?:(\w+)\s*)?(?:(\d{2,4})\s*)?/i;
    const fromToMatch = text.match(fromToPattern);
    
    if (fromToMatch) {
      const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = fromToMatch;
      
      // Parse start date
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      
      const startMonthNum = startMonth ? getMonthNumber(startMonth) : currentMonth + 1;
      const endMonthNum = endMonth ? getMonthNumber(endMonth) : startMonthNum;
      const startYearNum = startYear ? (startYear.length === 2 ? 2000 + parseInt(startYear) : parseInt(startYear)) : currentYear;
      const endYearNum = endYear ? (endYear.length === 2 ? 2000 + parseInt(endYear) : parseInt(endYear)) : startYearNum;
      
      startDate = `${startYearNum}-${String(startMonthNum).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
      endDate = `${endYearNum}-${String(endMonthNum).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    }

    // Pattern 2: "<dd>/<mm> - <dd>/<mm>" or "<dd>/<mm>/<yy>"
    if (!startDate) {
      const dateRangePattern = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*[-–]\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
      const dateRangeMatch = text.match(dateRangePattern);
      
      if (dateRangeMatch) {
        const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateRangeMatch;
        const currentYear = new Date().getFullYear();
        
        const startYearNum = startYear ? (startYear.length === 2 ? 2000 + parseInt(startYear) : parseInt(startYear)) : currentYear;
        const endYearNum = endYear ? (endYear.length === 2 ? 2000 + parseInt(endYear) : parseInt(endYear)) : startYearNum;
        
        startDate = `${startYearNum}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
        endDate = `${endYearNum}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      }
    }

    // Pattern 3: Single date format "<dd>/<mm>" or "<dd>/<mm>/<yy>"
    if (!startDate) {
      const singleDatePattern = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
      const singleDateMatch = text.match(singleDatePattern);
      
      if (singleDateMatch) {
        const [, day, month, year] = singleDateMatch;
        const currentYear = new Date().getFullYear();
        const yearNum = year ? (year.length === 2 ? 2000 + parseInt(year) : parseInt(year)) : currentYear;
        
        startDate = `${yearNum}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        endDate = startDate; // Same day
      }
    }

    // Extract reason - clean up the text by removing date mentions
    reason = rawText
      .replace(/from\s+\d{1,2}\s*\w*\s*\d*\s*to\s+\d{1,2}\s*\w*\s*\d*/gi, '')
      .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*[-–]\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, '')
      .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('Parsed result:', { type, startDate, endDate, reason });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          type,
          start_date: startDate,
          end_date: endDate,
          reason: reason || rawText
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in leave autofill:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

function getMonthNumber(monthStr: string): number {
  const months = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'september': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12
  };
  
  return months[monthStr.toLowerCase()] || new Date().getMonth() + 1;
}
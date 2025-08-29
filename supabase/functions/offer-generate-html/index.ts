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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { candidate_name, job_title, dept, ctc, joining_date, location, offer_id } = await req.json();
    
    if (!candidate_name || !job_title) {
      throw new Error('candidate_name and job_title are required');
    }

    console.log('Generating offer HTML for:', candidate_name, job_title);

    // Get current date in Asia/Kolkata timezone
    const today = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Format joining date
    const formattedJoiningDate = joining_date 
      ? new Date(joining_date).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long', 
          day: 'numeric'
        })
      : 'To be discussed';

    // Generate professional offer letter HTML
    const offerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offer of Employment - ${job_title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #e91e63;
            padding-bottom: 20px;
        }
        .company-name {
            font-size: 32px;
            font-weight: bold;
            color: #e91e63;
            margin: 0;
        }
        .offer-title {
            font-size: 24px;
            color: #333;
            margin: 20px 0;
            text-align: center;
        }
        .date {
            text-align: right;
            margin-bottom: 30px;
            color: #666;
        }
        .content {
            margin-bottom: 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
        }
        .details-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #e91e63;
        }
        .detail-item {
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .detail-label {
            font-weight: bold;
            color: #555;
            min-width: 150px;
        }
        .detail-value {
            color: #333;
            font-weight: 600;
        }
        .section {
            margin: 25px 0;
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #e91e63;
            margin-bottom: 10px;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #eee;
        }
        .signature {
            margin: 30px 0;
            text-align: left;
        }
        .disclaimer {
            background: #fff3e0;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #ff9800;
            font-size: 14px;
            color: #666;
            margin-top: 30px;
        }
        @media print {
            body { padding: 20px; }
            .disclaimer { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="company-name">Shreyas Media</h1>
        <p style="margin: 10px 0; color: #666;">Human Resource Management</p>
    </div>

    <div class="date">Date: ${today}</div>

    <h2 class="offer-title">Offer of Employment — ${job_title}</h2>

    <div class="content">
        <div class="greeting">
            Dear ${candidate_name},
        </div>

        <p>We are pleased to extend this offer of employment to you at <strong>Shreyas Media</strong>. We believe your skills and experience will be a valuable addition to our team.</p>

        <div class="details-section">
            <h3 style="margin-top: 0; color: #e91e63;">Position Details</h3>
            <div class="detail-item">
                <span class="detail-label">Job Title:</span>
                <span class="detail-value">${job_title}</span>
            </div>
            ${dept ? `<div class="detail-item">
                <span class="detail-label">Department:</span>
                <span class="detail-value">${dept}</span>
            </div>` : ''}
            ${location ? `<div class="detail-item">
                <span class="detail-label">Work Location:</span>
                <span class="detail-value">${location}</span>
            </div>` : ''}
            ${ctc ? `<div class="detail-item">
                <span class="detail-label">Total Compensation:</span>
                <span class="detail-value">${ctc}</span>
            </div>` : ''}
            <div class="detail-item">
                <span class="detail-label">Tentative Joining Date:</span>
                <span class="detail-value">${formattedJoiningDate}</span>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Terms & Conditions</div>
            <ul>
                <li><strong>Employment Type:</strong> This is a full-time position with Shreyas Media.</li>
                <li><strong>Probation Period:</strong> Your employment will be subject to a probationary period as per company policy.</li>
                <li><strong>Confidentiality:</strong> You will be required to maintain confidentiality of all company information and sign relevant agreements.</li>
                <li><strong>Documentation:</strong> Please bring required documents (ID proof, address proof, educational certificates, experience letters) on your joining date.</li>
                <li><strong>Medical Check-up:</strong> A medical fitness certificate may be required as per company policy.</li>
            </ul>
        </div>

        <div class="section">
            <div class="section-title">Next Steps</div>
            <p>To accept this offer, please click the "Accept Offer" button below. If you have any questions or need clarification on any aspect of this offer, please feel free to contact our HR team.</p>
            <p>We look forward to having you join our team and contribute to our continued success.</p>
        </div>
    </div>

    <div class="footer">
        <div class="signature">
            <p><strong>Sincerely,</strong></p>
            <p><strong>Shreyas Media — HR Team</strong></p>
            <p>Human Resources Department</p>
        </div>

        <div class="disclaimer">
            <strong>Note:</strong> This is a system-generated offer letter. Please use the Accept/Decline buttons provided in the offer portal to respond to this offer. This offer is valid for 7 days from the date of issue.
        </div>
    </div>
</body>
</html>`;

    // Update the offer with generated HTML
    if (offer_id) {
      const { error: updateError } = await supabaseClient
        .from('offers')
        .update({ offer_html: offerHtml })
        .eq('id', offer_id);

      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        html: offerHtml,
        message: 'Offer letter generated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error generating offer HTML:', error);
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
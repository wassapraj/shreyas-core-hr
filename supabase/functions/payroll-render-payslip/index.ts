import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { item_id } = await req.json();
    
    console.log('Rendering payslip for item:', item_id);

    // Load payroll_items + employees + payroll_runs
    const { data: item, error: itemError } = await supabase
      .from('payroll_items')
      .select(`
        *,
        employees!inner(first_name, last_name, emp_code, designation, doj, phone, email),
        payroll_runs!inner(month, year, run_id)
      `)
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      throw new Error('Payroll item not found');
    }

    console.log('Found payroll item for employee:', item.employees.emp_code);

    const employee = item.employees;
    const run = item.payroll_runs;
    const breakup = item.breakup_json || {};

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthName = monthNames[run.month - 1] || 'Unknown';

    // Mask PAN and bank details (show only last 4 chars)
    const maskValue = (value: string) => {
      if (!value || value.length <= 4) return value;
      return '*'.repeat(value.length - 4) + value.slice(-4);
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Payslip - ${monthName} ${run.year}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          margin: 20px;
          background: white;
          color: black;
          line-height: 1.4;
        }
        .payslip-header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .company-name {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .payslip-title {
          font-size: 16px;
          margin-bottom: 10px;
        }
        .employee-info {
          margin-bottom: 20px;
        }
        .employee-info table {
          width: 100%;
          border-collapse: collapse;
        }
        .employee-info td {
          padding: 4px 8px;
          border: 1px solid #000;
        }
        .earnings-deductions {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .earnings, .deductions {
          width: 48%;
        }
        .section-title {
          font-weight: bold;
          text-align: center;
          background: #f0f0f0;
          padding: 8px;
          border: 1px solid #000;
          margin-bottom: 0;
        }
        .amount-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        .amount-table td {
          padding: 6px 8px;
          border: 1px solid #000;
          text-align: right;
        }
        .amount-table td:first-child {
          text-align: left;
        }
        .net-pay {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          border: 2px solid #000;
          padding: 15px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          font-size: 12px;
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #000;
        }
        @media print {
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="payslip-header">
        <div class="company-name">SHREYAS MEDIA</div>
        <div class="payslip-title">Payslip — ${monthName} ${run.year}</div>
      </div>

      <div class="employee-info">
        <table>
          <tr>
            <td><strong>Employee Name:</strong></td>
            <td>${employee.first_name} ${employee.last_name}</td>
            <td><strong>Employee Code:</strong></td>
            <td>${employee.emp_code}</td>
          </tr>
          <tr>
            <td><strong>Designation:</strong></td>
            <td>${employee.designation || 'N/A'}</td>
            <td><strong>Date of Joining:</strong></td>
            <td>${employee.doj || 'N/A'}</td>
          </tr>
          <tr>
            <td><strong>Email:</strong></td>
            <td>${maskValue(employee.email || '')}</td>
            <td><strong>Phone:</strong></td>
            <td>${maskValue(employee.phone || '')}</td>
          </tr>
        </table>
      </div>

      <div class="earnings-deductions">
        <div class="earnings">
          <div class="section-title">EARNINGS</div>
          <table class="amount-table">
            <tr>
              <td>Basic Salary</td>
              <td>₹${(breakup.BASIC || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr>
              <td>House Rent Allowance</td>
              <td>₹${(breakup.HRA || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr>
              <td>Special Allowance</td>
              <td>₹${(breakup.SPECIAL || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr style="font-weight: bold; background: #f0f0f0;">
              <td>GROSS EARNINGS</td>
              <td>₹${(item.gross || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
          </table>
        </div>

        <div class="deductions">
          <div class="section-title">DEDUCTIONS</div>
          <table class="amount-table">
            <tr>
              <td>Provident Fund</td>
              <td>₹${(breakup.PF || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr>
              <td>Professional Tax</td>
              <td>₹${(breakup.PT || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr>
              <td>Loss of Pay (${(item.lop_days || 0).toFixed(1)} days)</td>
              <td>₹${(breakup.LOP || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
            <tr style="font-weight: bold; background: #f0f0f0;">
              <td>TOTAL DEDUCTIONS</td>
              <td>₹${(item.deductions || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="net-pay">
        NET PAY: ₹${(item.net || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}
      </div>

      <div class="footer">
        This is a system-generated payslip. No signature required.<br>
        <strong>Shreyas Media</strong>
      </div>
    </body>
    </html>
    `;

    console.log('Payslip HTML generated successfully');

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in payroll-render-payslip:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
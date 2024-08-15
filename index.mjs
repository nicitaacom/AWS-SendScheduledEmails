import moment from 'moment-timezone';
import { supabaseAdmin } from './dist/libs/supabaseAdmin.js'
import { resend } from './dist/libs/resend.js'

// render email using this function because you need each time render email async on client (on server .tsx not avaiable)
// DO NOT INSERT NEW LINES HERE - it may casuse unexpected output (its better to don't change this function - you may do it but do some backup before)
function renderedEmailString(body, email) {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<table>
  <tbody>
    <tr>
      <td>
        <p style="white-space: pre-wrap; word-break: break-word; margin: 0 0 8px 0;">${body.trim()}</p>
        <p style="font-size: 14px; white-space: pre-wrap; word-break: break-word; margin: 0;">If you no longer wish to receive these emails -&nbsp;<a href="https://ns-agency.eu/unsubscribe?email=${encodeURIComponent(email)}" target="_blank" style="color: blue; text-decoration: underline; --darkreader-inline-color: #337dff;" data-link-id="3" rel="noopener noreferrer" data-darkreader-inline-color="">unsubscribe</a></p>
      </td>
    </tr>
  </tbody>
</table>`;
}
export const handler = async (event) => {

  // normally I need to create schedule using cloudWatch SDK and pass this payload
  // const { id, scheduledAtISO, emailFrom, emailTo, subject, body } = event;

  const {data} = await supabaseAdmin.from('outreach_scheduled').select().order('scheduled_at',{ascending:true}).limit(1).single()


  if (!data.id) {
         return {
        statusCode: 400,
        body: JSON.stringify({ error: `id missing` }),
      };
  }
  if (!data.scheduled_at) {
         return {
        statusCode: 400,
        body: JSON.stringify({ error: `scheduledAtISO missing` }),
      };
  }
    if (!data.scheduled_from) {
         return {
        statusCode: 400,
        body: JSON.stringify({ error: `emailFrom missing` }),
      };
  }
    if (!data.scheduled_to) {
         return {
        statusCode: 400,
        body: JSON.stringify({ error: `emailTo missing` }),
      };
  }
    if (!data.scheduled_subject_line) {
         return {
        statusCode: 400,
        body: JSON.stringify({ error: `subject missing` }),
      };
  }
  if (!data.scheduled_body) {
         return {
        statusCode: 400,
        body: JSON.stringify({ error: `body missing` }),
      };
  }



  try {    
      const emailData = {
      from: data.scheduled_from,
      to: data.scheduled_to,
      subject: data.scheduled_subject_line,
      html: renderedEmailString(data.scheduled_body,data.scheduled_to)
    }



    // 1. sendEmailAction
    const { error } = await resend.emails.send(emailData)
    if (error) {
        return {
        statusCode: 400,
        body: JSON.stringify({ error: `error sending email - ${error}` }),
      };
    }







    // 2.updateDBOutreachedAction
     const { data:outreached_n_times } = await supabaseAdmin.from("outreached").select("outreached_n_times").eq("email", data.scheduled_to).single()
     const userTimezone = moment.tz.guess()
     if (!outreached_n_times) {
       await supabaseAdmin
          .from("outreached")
          .insert({ email: data.scheduled_to, last_outreach_at: moment.tz(userTimezone).toISOString() })
     }

  const { error:update_outreached_error } = await supabaseAdmin
    .from("outreached")
    .update({
      outreached_n_times: outreached_n_times.outreached_n_times + 1,
      last_outreach_at: moment.tz(userTimezone).toISOString(),
    })
    .eq("email", data.scheduled_to)

  if (update_outreached_error) {
     return {
        statusCode: 400,
        body: JSON.stringify({ error: `update_outreached_error  - ${JSON.stringify(update_outreached_error)}` }),
      }; 
  }




    



  // 3. updateDBOutreachedCounterAction
   const { data:outreaches_counter } = await supabaseAdmin.from("outreaches_counter").select().eq("id", 0).single()
  if (!outreaches_counter) {
    await supabaseAdmin.from("outreaches_counter").insert({ outreached_today: 1, outreached_total: 1 })
  }
  else {
    const { error:update_outreaches_counter_error } = await supabaseAdmin
    .from("outreaches_counter")
    .update({ outreached_today: outreaches_counter?.outreached_today + 1, outreached_total: outreaches_counter?.outreached_total + 1 })
    .eq("id", 0)
    if (update_outreaches_counter_error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `update_outreaches_counter_error  - ${update_outreaches_counter_error}` }),
      }; 
    }
  }



    // 4. deleteDBScheduledEmailAction
  await supabaseAdmin.from("outreach_scheduled").delete().eq("id", data.id).single()

      


  return {
    statusCode: 200,
    body: JSON.stringify({ message: `email was sent` }),
  };
    
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `Failed to send scheduled email - ${error instanceof Error ? error.message : error ? error : 'Unknown error'}`,
      }),
    };
  }
};

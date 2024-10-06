import moment from 'moment-timezone';
import { Resend } from "resend"
import { supabaseAdmin } from './dist/libs/supabaseAdmin.js'
import { decryptResend } from './dist/utils/decryptResend.js'

// render email using this function because you need each time render email async on client (on server .tsx not avaiable)
// DO NOT INSERT NEW LINES HERE - it may casuse unexpected output (its better to don't change this function - you may do it but do some backup before)
// TODO - emailFrom.split("@")[0] - name in the future - e.g "someName <someemail@domain.com>"
function renderedReplyEmailString(intialEmail, body, emailTo, emailFrom, image, scheduled_at) {
  moment.locale('en');
  const berlinTime = moment(scheduled_at).tz('Europe/Berlin');
  const formattedDate = berlinTime.format('D MMMM YYYY, HH:mm:ss');

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<table>
  <tbody>
    <tr>
      <td>
       <p style="white-space: pre-wrap; word-break: break-word; margin: 0 0 8px 0;">${intialEmail.trim()}</p>
      <div><br /></div>
                                    <div><i><span style="font-size:10pt;line-height:12pt;"><span style="font-family:Arial;">
                                                    ${formattedDate}, from ${emailFrom.split("@")[0]} <${emailFrom}>:
                                                </span></span></i></div>
                                    <div><br /></div>
                                    <blockquote style="border-left:1px solid rgb(204, 204, 204);margin:0px 0px 0px 0.8ex;padding-left:1ex;" data-darkreader-inline-border-left="">
                                        <div style="display:block;">
                                            <p style="white-space: pre-wrap; word-break: break-word; margin: 0 0 8px 0;">${body.trim()}</p>
                                            ${image && `<img src=${image} alt="email-image" />`}
                                        </div>
                                    </blockquote>


                                </span></div>
        <p style="font-size: 14px; white-space: pre-wrap; word-break: break-word; margin: 0;">If you no longer wish to receive these emails -&nbsp;<a href="https://ns-agency.eu/unsubscribe?email=${encodeURIComponent(emailTo)}" target="_blank" style="color: blue; text-decoration: underline; --darkreader-inline-color: #337dff;" data-link-id="3" rel="noopener noreferrer" data-darkreader-inline-color="">unsubscribe</a></p>
      </td>
    </tr>
  </tbody>
</table>`;
}

/**
 * 
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

 */

export const handler = async (event) => {

  // normally I need to create schedule using cloudWatch SDK and pass this payload
  // const { id, scheduledAtISO, emailFrom, emailTo, subject, body } = event;

  const {data} = await supabaseAdmin.from('outreach_scheduled').select().order('scheduled_at',{ascending:true}).limit(1).single()

  if (!data) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `no scheduled emails` }),
    };
  }
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
      html: renderedReplyEmailString(
        data.initial_email_body,
        data.scheduled_body,
        data.scheduled_to,
        data.scheduled_from,
        data.scheduled_image_url,
        data.scheduled_at)
    }


  // 1. sendEmailAction
  // 1.1 Create Resend SDK instance
  const decryptedEnvResend = await decryptResend(data.encrypted_resend)
  if (typeof decryptedEnvResend === 'string') {
    return decryptedEnvResend
  }


  const resend = new Resend(decryptedEnvResend.value)

  // 1.2 Send email
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




  // 4. insertSentAction
  await supabaseAdmin
          .from("sent")
          .insert({ subject:`follow-up-${data.scheduled_subject_line}`, body:data.scheduled_body, sent_to:data.scheduled_to, sent_from:data.scheduled_from  })


    // 5. deleteDBScheduledEmailAction
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

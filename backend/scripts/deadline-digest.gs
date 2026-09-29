/**
 * ZEMP deadline digest — paste into script.google.com while signed in to the Zypp mailbox the
 * emails should come from (e.g. no-reply@zypp.app). Mail is sent as that account, so no DNS,
 * SMTP or email provider is needed.
 *
 * Setup (once):
 *   1. Project Settings → Script properties → add:
 *        ZEMP_API      = https://<your-backend>.onrender.com/api/v1   (the backend, not Vercel)
 *        DIGEST_SECRET = the same value as DIGEST_SECRET on the backend
 *   2. Run `sendDeadlineDigest` once and approve the permissions.
 *   3. Run `installDailyTrigger` once — the digest then goes out every morning at ~9 AM.
 */
function sendDeadlineDigest() {
  var props = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch(props.getProperty('ZEMP_API') + '/digest/deadlines', {
    headers: { 'x-digest-secret': props.getProperty('DIGEST_SECRET') },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('ZEMP returned ' + res.getResponseCode() + ': ' + res.getContentText());
  var emails = JSON.parse(res.getContentText()).data || [];
  emails.forEach(function (e) {
    MailApp.sendEmail({ to: e.to, subject: e.subject, body: e.body, name: 'ZEMP', noReply: true });
  });
  Logger.log('Sent ' + emails.length + ' digest email(s).');
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDeadlineDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDeadlineDigest').timeBased().everyDays(1).atHour(9).create();
}

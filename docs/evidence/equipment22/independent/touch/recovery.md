# Authorized kernel bootstrap recovery

The original result.md remains unchanged and INCOMPLETE. Coordinator authorized one fresh bootstrap after the tool explicitly reset its kernel, using the identical browser id and a 12-second tool timeout, without expanding access or retrying any rejected App/DevTools operation.

The fresh `cua.getBrowser({id:'1'})` completed in 13.7492 seconds and returned supported browser documentation. A new task-only tab 1375938233 was created for http://127.0.0.1:4182. Navigation returned `net::ERR_CONNECTION_REFUSED` in 7.5704 seconds. Binding this known self-created tab showed the Chrome connection-refused page. No other tabs were listed or claimed.

The official tab CDP capability documentation was successfully read. It exposes `send(method, params, {timeoutMs})`, is scoped to the current web origin, and instructs navigating to the intended HTTP page before the first CDP command. No CDP command was sent on the error page. Coordinator was notified to restore the intended candidate server.

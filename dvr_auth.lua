
-- Flussonic DVR Read Authentication Backend Script

-- This function is called by Flussonic for every DVR playback request
-- when `dvr_read_auth_backend` is configured in flussonic.conf.
-- It receives the request parameters as a JSON object in the request body.

function auth(req)
  -- The URL of your Next.js API endpoint
  -- IMPORTANT: Replace with the actual internal or external URL of your Next.js app
  local auth_url = "http://localhost:4000/api/flussonic_auth"

  -- The request body to be sent to your API
  -- It includes all necessary information for validation
  local auth_req = {
    ip = req:ip(),
    name = req:name(),
    stream = req:stream(),
    user = req:user(),
    password = req:password(),
    token = req:token(),
    proto = req:proto()
  }

  -- Make an HTTP POST request to your Next.js authentication API
  -- The `post_json` function is built into Flussonic's Lua environment
  local ok, response = post_json(auth_url, auth_req)

  -- Check if the HTTP request itself was successful
  if not ok then
    log.info("DVR auth failed: HTTP request to backend failed: " .. tostring(response))
    return false
  end

  -- Check the 'allow' field in the JSON response from your API
  if response.allow == true then
    log.info("DVR auth successful for user " .. tostring(req:user()) .. " on stream " .. req:stream())
    return true -- Grant access
  else
    log.info("DVR auth denied for user " .. tostring(req:user()) .. " on stream " .. req:stream() .. ". Reason: " .. tostring(response.reason))
    return false -- Deny access
  end
end

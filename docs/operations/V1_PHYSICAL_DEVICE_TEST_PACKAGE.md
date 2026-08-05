# KansRide V1 Physical-Device Test Package

Record device model/Android version, app build/profile, package ID, backend URL, UTC time, ride reference, expected result, actual result, and screenshot/log evidence for every case. Do not record tokens, OTPs, PINs, passwords, or private phone numbers.

| # | Test | Setup | Expected result | Failure evidence |
|---|---|---|---|---|
| 1 | Passenger login | Fresh passenger app, configured HTTPS/LAN API | OTP login restores a session and reaches Home | Screen, UTC time, API status |
| 2 | Driver login | Fresh driver app and approved account | Driver session restores and profile loads | Screen, API status |
| 3 | Driver online | Approved driver with active subscription | Online transition succeeds only with a real GPS fix | GPS/permission state, ride reference |
| 4 | GPS updates | Driver moving or emulator location enabled | Location watcher emits canonical coordinates without duplicates | Timestamped location behavior |
| 5 | Destination selection | Passenger has real pickup | Curated/saved destination marker appears | Screen and selected coordinates only if non-sensitive |
| 6 | Fare estimate | Pickup and destination selected | Backend estimate shows fare, distance, ETA | Response status and screen |
| 7 | Ride request | Valid estimate visible | Ride is created and acknowledged private subscription completes | Ride reference, screen |
| 8 | Private offer | Driver online and eligible | Only eligible driver receives offer | Driver screen and ride reference |
| 9 | Acceptance | Offer visible on driver | One driver wins and passenger receives assignment | Both screens |
| 10 | Navigation pickup | Assigned/en-route driver | External navigation opens pickup target | Target state and app result |
| 11 | Arrival | Driver at pickup | Arrival state persists and is visible | Ride reference/status |
| 12 | Verification | Passenger presents PIN privately | Only assigned driver can verify; no PIN appears in logs/tracking | Status and privacy check |
| 13 | Trip start | Verified passenger | Trip enters progress state | Ride status |
| 14 | Live tracking | Active trip and shared link | Passenger/tracking receives authorized location updates | Timestamp/status |
| 15 | Completion | Trip in progress | Final fare persists and completion is visible | Ride reference/fare |
| 16 | History | Completed ride | Passenger and driver history show the ride | Screen |
| 17 | Rating | Completed unrated passenger ride | One rating succeeds; duplicate is rejected | API result/status |
| 18 | Cancellation | Cancellable ride | Reason persists and unauthorized actor is rejected | Ride status/reason |
| 19 | Share/revoke | Active passenger ride | Tracking link works, then backend revoke stops access | Link state, no token capture |
| 20 | Network loss | Active ride | Reconnect banner/state appears and subscriptions recover | Start/end times |
| 21 | Background/foreground | Active driver/passenger app | V1 foreground-only policy remains honest; no false online state | App state and banner |
| 22 | Terminate/restart | Active ride, force-stop app | Ride reconciles from backend on restart | Ride reference/status |
| 23 | GPS disabled | Disable location services | Clear location error and retry path appear | Screen |
| 24 | Permission denied | Deny foreground permission | Clear denied/blocked state appears | Screen and OS state |
| 25 | Invalid tracking link | Alter/expire a link | Generic invalid/expired state; no private data | Screen/status |
| 26 | Empty/error/retry | Disconnect API or use empty account | Loading, empty, failure and retry states are honest | Screen and error evidence |

Physical installation, real GPS, TalkBack, performance, and network behavior are owner/device evidence; this repository does not claim them locally.

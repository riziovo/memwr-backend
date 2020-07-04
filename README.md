# memwr-backend

This is the backend module for the multiplayer game Memwr.

This is a lightweight highly specialised server to serve the game traffic for multiplayer option.

There are two files:
<br/>
#1 wsbe.js => This is the server file.
<br/>
#2 u.js    => This is an implementation of a Array-backed RingBuffer to help minimize the resource usage.


<br/><br/>

The messages are kept as low as sub 4B to support low-latency communication.
<br/>
No heavy computations and the message-flow is highly streamlined.

<br/>
The ws achieves 300K connections per second which makes a strong case for this server utility itself as it has little to no computational overhead.
<br/>
I plan to do an update with stress tests soon.

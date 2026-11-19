# app_limitorder_snapshot

หน้าเว็บให้ user ใส่แอดเดรสแล้วดูยอด AED2 / 18A5 ของตัวเอง ก่อนย้ายไปเชนใหม่

- ในกระเป๋า (`balanceOf`)
- ฝากใน LimitOrder (`balance()` ของ `0xc202…Dae010`)
- ล็อกในออเดอร์ที่เปิดค้าง
- ค้างใน LimitOrder รวม = ฝาก + ออเดอร์ (`balance()` ไม่รวมยอดในออเดอร์ จึงบวกกันได้ไม่ซ้ำ)

ตอนเปิดหน้า เว็บอ่านจาก `public/snapshot.json` ที่ถ่ายไว้ที่บล็อกเดียว ไม่ยิง RPC ทุกคนจึงเห็นยอดชุดเดียวกัน
ปุ่ม "เช็คยอดล่าสุดจาก chain" ยิง `getUserInfo` สด 1 call

## ขั้นตอน

1. `cp .env.example .env` แล้วใส่ `VITE_PROJECT_ID`, `VITE_READER_ADDRESS` (Proxy ของ LimitOrderReader)
2. ใส่บล็อกที่ deploy ของแต่ละคอนแทรคใน `START_BLOCK_*` (ใส่ 0 ได้ แต่สแกนนานขึ้น)
3. ถ่าย snapshot: `node --env-file=.env scripts/snapshot.js` (Node 20+, ไม่ต้องลงอะไรเพิ่ม)
   - หาแอดเดรสจาก Transfer ของทั้ง 2 เหรียญ + event ของ LimitOrder (Deposit, Withdrawn, NewOrderPlace, MatchOrder, RevokedOrder) + เจ้าของออเดอร์ที่เปิดอยู่
   - เพิ่มแอดเดรสเองได้ใน `scripts/extra-addresses.txt` (บรรทัดละ 1 แอดเดรส)
   - อ่านทุกแอดเดรสผ่าน `getUsersInfo` ที่บล็อกเดียวกัน ตัดคนที่ยอดเป็น 0 ทั้งหมดออก แล้วเขียน `public/snapshot.json`
   - ท้ายสคริปต์พิมพ์การตรวจยอด: เหรียญที่ LimitOrder ถือจริง เทียบกับยอดที่ค้างจ่าย user
4. `npm install` → `npm run dev` ดูในเครื่อง → deploy ขึ้น Vercel

ตอนจะย้ายเชนจริง ให้หยุดรับธุรกรรมก่อน แล้วถ่าย snapshot ใหม่โดยใส่ `SNAPSHOT_BLOCK` ให้ตรงบล็อกที่ปิด
ถ้า RPC ฟ้อง state ไม่มี (บล็อกเก่า) ให้ใช้ archive RPC ใน `SNAPSHOT_RPC`

ปุ่ม "ดาวน์โหลด CSV" ให้รายการทุกแอดเดรสแบบเลขเต็มทศนิยม ใช้เป็นไฟล์แจกเหรียญบนเชนใหม่ได้

## ไฟล์

```
scripts/snapshot.js          สร้าง public/snapshot.json
src/web3/contracts/          LimitOrderReaderEngine.sol, LimitOrderReaderProxy.sol, contract_reader.js
src/web3/intereacts/         getContractData (โหลด snapshot), getLiveUserInfo (อ่านสด)
src/componants/              ui.js (ปุ่ม, จัดรูปตัวเลขแบบ BigInt), snapshot.js (แปลง/กรอง/CSV), header.js
src/pages/lookup/            ช่องค้นหาแอดเดรส + ผลของแอดเดรสนั้น
src/pages/holders/           ยอดรวม + ตารางทุกแอดเดรส
```

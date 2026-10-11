# İzin gerekçeleri — Türkçe

Mağaza incelemesi her izin için ayrı bir gerekçe ister. Aşağıdaki metinler
doğrudan forma yapıştırılabilir.

---

## `storage`

```
Kullanıcının ayarlarını (oturum süreleri, mola tercihleri, tema, ses) ve çalışan zamanlayıcının durumunu kaydetmek için gereklidir. Zamanlayıcı durumu yerel depoda tutulur, böylece tarayıcı kapanıp açılsa bile oturum doğru süreyle devam eder. Hiçbir veri cihazdan dışarı çıkmaz.
```

## `alarms`

```
Odak oturumlarının ve molaların bitiş anını zamanlamak için gereklidir. Manifest V3'te service worker her an uyutulabildiği için setTimeout/setInterval güvenilir değildir; bitiş anları chrome.alarms ile mutlak zaman damgalarına kurulur. Alarm olmadan zamanlayıcı, tarayıcı arka plandayken çalışamaz.
```

## `notifications`

```
Odak oturumu veya mola bittiğinde kullanıcıyı bilgilendirmek için gereklidir. Bildirimler eklentinin temel işlevidir: kullanıcı başka bir sekmedeyken zamanlayıcının bittiğini başka türlü öğrenemez.
```

## `idle`

```
Kullanıcı bilgisayar başından ayrıldığında veya ekran kilitlendiğinde kronometreyi duraklatmak ve sağlık molası sayaçlarını sıfırlamak için gereklidir. Kullanıcı ekrandan uzaktayken geçen süre çalışma sayılmamalı, ayrıca o sırada zaten mola verilmiş sayılmalıdır. Yalnızca "boşta / etkin / kilitli" durumu okunur; başka hiçbir bilgi alınmaz.
```

## `offscreen` (yalnızca Chrome ve Edge)

```
Oturum ve mola bitişlerinde kısa bir bildirim sesi çalmak için gereklidir. Service worker'da Web Audio API kullanılamadığından ses, yalnızca ton çalarken açılan ve hemen kapatılan geçici bir offscreen belgede üretilir. Pakette ses dosyası yoktur; ton Web Audio ile üretilir. Belge kalıcı olarak açık tutulmaz.
```

## `tabs` (isteğe bağlı — yalnızca kullanıcı isterse)

```
Yalnızca kullanıcı "toplantı algılama" özelliğini açtığında, ayarlar sayfasındaki anahtara tıklamasıyla çalışma anında istenir. Özellik kapalıyken izin hiç istenmez ve hiçbir sekme sorgulanmaz.

Açıkken yalnızca ETKİN sekmenin adresi okunur ve kullanıcının düzenleyebildiği bir toplantı alan adı listesiyle (varsayılan: meet.google.com, zoom.us, teams.microsoft.com, teams.live.com) karşılaştırılır. Eşleşiyorsa hatırlatmalar geçici olarak susturulur.

Adres hiçbir yere kaydedilmez, saklanmaz veya iletilmez; yalnızca bellekte karşılaştırılır. Kullanıcı özelliği kapattığında izin tarayıcıdan geri alınır.
```

---

## Host izni ve içerik betiği

Eklentinin **hiçbir host izni yoktur** ve hiçbir sayfaya içerik betiği enjekte
etmez. Mola ekranı, gezilen sayfanın üzerine bindirilmez; eklentinin kendi
penceresi olarak açılır.

## Uzaktan kod

Uzaktan kod çalıştırılmaz. Tüm betikler, stiller ve yazı tipi paketin içindedir.
Eklenti hiçbir ağ isteği yapmaz.

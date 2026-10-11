# Privacy Policy — Breather

**Last updated:** 11 October 2026

## In short

Breather collects no data, sends nothing anywhere and makes no network requests.
No account is required. Everything you produce stays in your own browser.

## What is stored?

Breather stores the following **on your device**:

| Data                                                  | Where           | Why                                                                             |
| ----------------------------------------------------- | --------------- | ------------------------------------------------------------------------------- |
| Settings (durations, break preferences, theme, sound) | `storage.sync`  | So the same settings follow you across devices signed into your browser account |
| Timer state, break counters                           | `storage.local` | So a running session continues correctly even if the browser closes             |
| Work history: sessions, notes, ratings, break records | IndexedDB       | To show your statistics                                                         |

If you are signed into your browser account, `storage.sync` data is moved between
your devices by the **browser's own** sync infrastructure (Chrome Sync, Firefox Sync).
That is a service your browser provides; Breather only ever touches the copy on your
device, and nothing reaches the extension's developer. You can turn sync off in
your browser settings.

## What is transmitted?

**Nothing.** There is no server, no analytics, no crash reporting, no ads and no
tracking. The extension makes no network requests at all. Even the typeface is
bundled inside the package; nothing is loaded from outside.

You can verify this yourself: open developer tools on the extension's service
worker and watch the Network tab — you will see no requests.

## Permissions and why they are needed

| Permission                     | Used for                                                                                                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                      | Saving settings and timer state                                                                                                                                                                                                                |
| `alarms`                       | Scheduling session and break endings (the only reliable way once the service worker sleeps)                                                                                                                                                    |
| `notifications`                | Session and break notifications                                                                                                                                                                                                                |
| `idle`                         | Pausing the timer and resetting break counters when you step away                                                                                                                                                                              |
| `offscreen` (Chrome/Edge only) | Playing the notification tone; a service worker cannot play audio                                                                                                                                                                              |
| `tabs` (optional)              | Requested only if you turn on "meeting detection". Only the active tab's address is read and compared against known meeting domains. The address is never written down, stored or transmitted. Turning the feature off revokes the permission. |

Breather injects no content scripts into any page; it has no access to the content of
the sites you visit.

## Exporting and deleting your data

- **Settings > Data > Export:** a full JSON backup of everything, or a CSV of your sessions.
- **Settings > Data > Delete all data:** permanently deletes your history.
- Uninstalling the extension also removes all extension data held by the browser.

## Children

Breather is not directed at children and collects no personal information from anyone.

## Changes

If this policy changes, the updated version is published in the extension's
repository and the "Last updated" date is revised.

## Contact

For questions and reports, please use the issue tracker in the extension's repository.

---

# Gizlilik Politikası — Breather

**Son güncelleme:** 11 Ekim 2026

## Kısaca

Breather hiçbir veri toplamaz, hiçbir yere veri göndermez ve hiçbir ağ isteği yapmaz.
Hesap gerekmez. Ürettiğin bütün veri yalnızca kendi tarayıcında kalır.

## Hangi veriler tutuluyor?

Breather aşağıdakileri **senin cihazında** saklar:

| Veri                                                        | Nerede          | Neden                                                                |
| ----------------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| Ayarlar (süreler, mola tercihleri, tema, ses)               | `storage.sync`  | Tarayıcı hesabınla aynı ayarları başka cihazlarda da görebilmen için |
| Zamanlayıcı durumu, mola sayaçları                          | `storage.local` | Çalışan oturumun tarayıcı kapansa da doğru devam etmesi için         |
| Çalışma geçmişi: oturumlar, notlar, puanlar, mola kayıtları | IndexedDB       | İstatistikleri gösterebilmek için                                    |

`storage.sync` verisi, tarayıcı hesabında oturum açtıysan tarayıcının **kendi**
senkronizasyon altyapısıyla cihazların arasında taşınır (Chrome Sync, Firefox Sync).
Bu, tarayıcının sunduğu bir hizmettir; Breather'ın bu veriye erişimi kendi cihazındaki
kopya üzerindendir ve eklentinin geliştiricisine hiçbir şey ulaşmaz. Senkronizasyonu
tarayıcı ayarlarından kapatabilirsin.

## Hangi veriler gönderiliyor?

**Hiçbiri.** Breather'da sunucu yok, analitik yok, çökme raporlama yok, reklam yok,
izleme yok. Eklenti hiçbir ağ isteği yapmaz. Yazı tipi bile paketin içindedir;
dışarıdan hiçbir dosya yüklenmez.

Bunu kendin doğrulayabilirsin: eklentinin service worker'ında geliştirici
araçlarını açıp Ağ sekmesine bakman yeterli — hiç istek görmeyeceksin.

## İzinler ve neden gerekli oldukları

| İzin                               | Ne için                                                                                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                          | Ayarları ve zamanlayıcı durumunu kaydetmek                                                                                                                                                                                                   |
| `alarms`                           | Oturum ve mola bitişlerini zamanlamak (service worker uyuduğunda tek güvenilir yol)                                                                                                                                                          |
| `notifications`                    | Oturum ve mola bildirimleri                                                                                                                                                                                                                  |
| `idle`                             | Bilgisayar başından ayrıldığında sayacı duraklatmak ve molaları yeniden kurmak                                                                                                                                                               |
| `offscreen` (yalnızca Chrome/Edge) | Bildirim sesini çalmak; service worker'da ses çalınamaz                                                                                                                                                                                      |
| `tabs` (isteğe bağlı)              | Yalnızca "toplantı algılama" özelliğini açarsan istenir. Yalnızca etkin sekmenin adresi okunur ve bilinen toplantı alan adlarıyla karşılaştırılır. Adres hiçbir yere yazılmaz, saklanmaz, gönderilmez. Özelliği kapatırsan izin geri alınır. |

Breather hiçbir sayfaya içerik betiği enjekte etmez; gezdiğin sitelerin içeriğine
erişimi yoktur.

## Verini dışa aktarma ve silme

- **Ayarlar > Veri > Dışa aktar:** tüm verinin JSON yedeği veya oturumların CSV'si.
- **Ayarlar > Veri > Tüm veriyi sil:** geçmişi kalıcı olarak siler.
- Eklentiyi kaldırmak tarayıcının sakladığı tüm eklenti verisini de siler.

## Çocuklar

Breather çocuklara yönelik değildir ve hiç kimseden kişisel bilgi toplamaz.

## Değişiklikler

Bu politika değişirse güncellenmiş hâli eklenti deposunda yayımlanır ve
"Son güncelleme" tarihi değiştirilir.

## İletişim

Soru ve bildirimler için eklentinin deposundaki sorun (issue) kayıtlarını kullan.

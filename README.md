# Sikke Arşivi

Veritabanı kullanmadan GitHub Pages üzerinde çalışan kişisel para koleksiyonu sitesi.

## İlk kurulum

1. `config.js` dosyasındaki `GITHUB_KULLANICI_ADINIZ` değerini kendi GitHub kullanıcı adınızla değiştirin.
2. GitHub'da **sikke-arsivi** adında herkese açık bir depo oluşturun. Başka ad kullanırsanız `config.js` içindeki `repository` değerini de değiştirin.
3. Bu klasördeki bütün dosya ve klasörleri deponun ana dizinine yükleyin.
4. Deponun **Settings → Pages** bölümünde kaynağı `Deploy from a branch`, dalı `main` ve klasörü `/ (root)` seçin.
5. GitHub'da **Settings → Developer settings → Personal access tokens → Fine-grained tokens** yolundan yalnızca bu depoya erişebilen bir anahtar oluşturun. `Repository permissions → Contents` yetkisini `Read and write` yapın.

## Telefonda para ekleme

Yayınlanan sitenin `admin.html` sayfasını açın, erişim anahtarınızı girin ve fotoğrafları seçin. Anahtar hiçbir dosyada veya tarayıcı deposunda saklanmaz; sayfa kapanınca unutulur.

### Fotoğraf standardı

- Ön ve arka yüzü yüklemeden önce **1600 × 1600 px** kare hazırlayın.
- Parayı ortalayın ve çevresinde yaklaşık **%8–10 boşluk** bırakın.
- İki yüzde de aynı ölçeği kullanın. Site fotoğrafları kırpmaz; yalnızca gerekirse küçültüp WebP biçimine dönüştürür.

### Kayıt düzenleme ve silme

Yönetici girişi yaptıktan sonra **Eklenen paralar** bölümünden bir kaydı düzenleyebilirsiniz. Düzenlerken yalnızca değiştirmek istediğiniz yüzün yeni fotoğrafını seçmeniz yeterlidir; yeni fotoğraf kayda bağlandıktan sonra eski dosya otomatik silinir. Bir veya birden fazla kayıt silmek için **Sil** düğmesiyle seçim modunu açın, kayıtları işaretleyin ve **Silmeyi onayla** düğmesine basın. **Vazgeç** düğmesi seçim yapmadan normal görünüme döner. Seçilen kayıtlar `data/coins.json` dosyasından tek güncellemede kaldırılır ve bunlara ait ön/arka yüz görselleri de silinir.

## Tema seçimi

Varsayılan tema mordur. `index.html` ve `admin.html` içindeki `theme-purple` sınıfını `theme-blue`, `theme-mint` veya `theme-pink` ile değiştirerek yalnızca ana renkleri değiştirebilirsiniz; arka plan, metin, kenarlık ve durum renkleri sabit kalır.

## Güvenlik

- Yönetici kullanıcı adı `config.js` içindeki adla sınırlandırılır.
- Asıl yazma yetkisi GitHub erişim anahtarıyla korunur.
- Anahtarı hiçbir zaman `config.js`, HTML veya başka bir depo dosyasına yazmayın.
- Anahtarı kaybederseniz GitHub ayarlarından iptal edip yenisini oluşturun.

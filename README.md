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

## Güvenlik

- Yönetici kullanıcı adı `config.js` içindeki adla sınırlandırılır.
- Asıl yazma yetkisi GitHub erişim anahtarıyla korunur.
- Anahtarı hiçbir zaman `config.js`, HTML veya başka bir depo dosyasına yazmayın.
- Anahtarı kaybederseniz GitHub ayarlarından iptal edip yenisini oluşturun.

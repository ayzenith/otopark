import { Alert } from "@/components/ui";

export const metadata = { title: "Oto Yıkama" };

export default function YikamaSayfasi() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Oto yıkama</h1>
      <Alert tur="bilgi" baslik="Bu modül Aşama 4'te geliştirilecek">
        Yıkama kuyruğu, hizmet seçimi, durum takibi ve tahsilat Aşama 4 kapsamındadır.
        Hizmet fiyatları henüz girilmedi (bkz. docs/07 - S13).
      </Alert>
    </div>
  );
}

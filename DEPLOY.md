# Instrukcja wdrożenia na Vercel

## ✅ Wykonane poprawki

### 1. Konfiguracja Next.js (`next.config.js`)
- ✅ Dodano konfigurację webpack dla bibliotek wymagających środowiska przeglądarki
- ✅ Skonfigurowano fallback dla fs, net, tls (niepotrzebne po stronie klienta)
- ✅ Włączono reactStrictMode

### 2. Bezpieczeństwo SSR
- ✅ Wszystkie komponenty używające `html-to-image` i `recharts` mają dyrektywę `"use client"`
- ✅ Dodano sprawdzenie `typeof window !== 'undefined'` przed użyciem `document` w `StockMap.tsx`
- ✅ Funkcja `handleDownloadImage` jest bezpieczna dla SSR

### 3. Zależności
- ✅ Wszystkie wymagane biblioteki są w `package.json`:
  - `recharts` ^3.5.1
  - `html-to-image` ^1.11.13
  - `xlsx` ^0.18.5
  - `clsx` ^2.1.1
  - `next` ^14.2.0
  - `react` ^18.3.1
  - `react-dom` ^18.3.1

### 4. Konfiguracja Tailwind CSS
- ✅ `tailwind.config.ts` poprawnie skonfigurowany
- ✅ `postcss.config.js` poprawnie skonfigurowany
- ✅ `globals.css` zawiera wymagane dyrektywy Tailwind

### 5. TypeScript
- ✅ `tsconfig.json` poprawnie skonfigurowany dla Next.js 14
- ✅ Path aliases (`@/*`) skonfigurowane

## 🚀 Kroki wdrożenia na Vercel

### Opcja 1: Wdrożenie przez Vercel CLI

```bash
# 1. Zainstaluj Vercel CLI (jeśli nie masz)
npm i -g vercel

# 2. Zaloguj się do Vercel
vercel login

# 3. Wdróż projekt
vercel

# 4. (Opcjonalnie) Wdróż do produkcji
vercel --prod
```

### Opcja 2: Wdrożenie przez GitHub

1. **Zapisz zmiany w Git:**
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

2. **Połącz repozytorium z Vercel:**
   - Przejdź do [vercel.com](https://vercel.com)
   - Kliknij "New Project"
   - Połącz swoje repozytorium GitHub
   - Vercel automatycznie wykryje Next.js i skonfiguruje projekt

3. **Vercel automatycznie:**
   - Wykryje framework (Next.js)
   - Uruchomi `npm install`
   - Uruchomi `npm run build`
   - Wdroży projekt

### Opcja 3: Wdrożenie przez Vercel Dashboard

1. Przejdź do [vercel.com/new](https://vercel.com/new)
2. Zaimportuj projekt z Git (GitHub/GitLab/Bitbucket)
3. Vercel automatycznie wykryje ustawienia
4. Kliknij "Deploy"

## 🔍 Weryfikacja przed wdrożeniem

Przed wdrożeniem możesz przetestować build lokalnie:

```bash
# Zainstaluj zależności
npm install

# Uruchom build (symuluje produkcję)
npm run build

# Uruchom serwer produkcyjny lokalnie
npm start
```

## ⚠️ Potencjalne problemy i rozwiązania

### Problem: "Window is not defined"
**Rozwiązanie:** ✅ Naprawione - dodano sprawdzenie `typeof window !== 'undefined'`

### Problem: "Module not found"
**Rozwiązanie:** Upewnij się, że wszystkie zależności są w `package.json` i uruchom `npm install`

### Problem: "Hydration Mismatch"
**Rozwiązanie:** ✅ Naprawione - wszystkie komponenty z `html-to-image` mają `"use client"`

### Problem: Błędy TypeScript
**Rozwiązanie:** Uruchom `npm run build` lokalnie, aby sprawdzić błędy przed wdrożeniem

## 📝 Uwagi

- Projekt używa Next.js 14 z App Router
- Wszystkie komponenty interaktywne są oznaczone jako `"use client"`
- `html-to-image` działa tylko po stronie klienta (bezpieczne sprawdzenia dodane)
- `recharts` wymaga środowiska przeglądarki (komponenty mają `"use client"`)

## ✅ Gotowe do wdrożenia!

Projekt jest gotowy do wdrożenia na Vercel. Wszystkie wymagane poprawki zostały wprowadzone.


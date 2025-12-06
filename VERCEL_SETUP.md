# 🚀 Wdrożenie na Vercel - Instrukcja

## ✅ Projekt został wypchnięty na GitHub
Repozytorium: https://github.com/MikolajSapek/PrologisProject.git

## 📋 Kroki wdrożenia na Vercel

### Opcja 1: Wdrożenie przez Vercel Dashboard (Zalecane)

1. **Przejdź do Vercel:**
   - Otwórz [vercel.com](https://vercel.com)
   - Zaloguj się (lub utwórz konto)

2. **Połącz repozytorium:**
   - Kliknij **"Add New..."** → **"Project"**
   - Wybierz **"Import Git Repository"**
   - Połącz swoje konto GitHub (jeśli jeszcze nie)
   - Znajdź repozytorium **"PrologisProject"**
   - Kliknij **"Import"**

3. **Konfiguracja projektu:**
   - Vercel automatycznie wykryje:
     - Framework: **Next.js**
     - Build Command: `npm run build`
     - Output Directory: `.next`
   - **Nie zmieniaj** tych ustawień (są poprawne)

4. **Wdróż:**
   - Kliknij **"Deploy"**
   - Vercel automatycznie:
     - Zainstaluje zależności (`npm install`)
     - Zbuduje projekt (`npm run build`)
     - Wdroży na produkcję

5. **Gotowe!**
   - Po zakończeniu otrzymasz link do Twojej aplikacji
   - Każdy push do `main` automatycznie wdroży nową wersję

### Opcja 2: Wdrożenie przez Vercel CLI

```bash
# 1. Zainstaluj Vercel CLI
npm i -g vercel

# 2. Zaloguj się
vercel login

# 3. Wdróż projekt
cd "/Users/sapek/Desktop/Prologis projekct "
vercel

# 4. Połącz z repozytorium GitHub (opcjonalnie)
vercel git connect
```

## 🔍 Weryfikacja przed wdrożeniem

Projekt został już przetestowany i jest gotowy, ale możesz sprawdzić lokalnie:

```bash
# Zainstaluj zależności (jeśli jeszcze nie)
npm install

# Przetestuj build
npm run build

# Uruchom lokalnie w trybie produkcyjnym
npm start
```

## ✅ Co zostało przygotowane

- ✅ Konfiguracja Next.js (`next.config.js`) z webpack dla `html-to-image`
- ✅ Sprawdzenia bezpieczeństwa SSR w `StockMap.tsx`
- ✅ Wszystkie komponenty mają `"use client"` gdzie potrzeba
- ✅ `.gitignore` poprawnie skonfigurowany
- ✅ Wszystkie zależności w `package.json`

## 🎯 Po wdrożeniu

1. **Automatyczne wdrożenia:**
   - Każdy push do `main` automatycznie wdroży nową wersję
   - Pull Requesty otrzymają preview deployment

2. **Zmienne środowiskowe:**
   - Jeśli będziesz potrzebować (np. API keys), dodaj je w:
   - Vercel Dashboard → Project → Settings → Environment Variables

3. **Domeny:**
   - Vercel automatycznie przypisze domenę `*.vercel.app`
   - Możesz dodać własną domenę w Settings → Domains

## 📝 Uwagi

- Projekt używa Next.js 14 z App Router
- Wszystkie komponenty interaktywne są oznaczone jako `"use client"`
- `html-to-image` działa tylko po stronie klienta (bezpieczne sprawdzenia dodane)
- `recharts` wymaga środowiska przeglądarki (komponenty mają `"use client"`)

## 🆘 W razie problemów

Jeśli wystąpią błędy podczas wdrożenia:

1. **Sprawdź logi builda** w Vercel Dashboard
2. **Przetestuj lokalnie:** `npm run build`
3. **Sprawdź czy wszystkie zależności są w `package.json`**
4. **Upewnij się, że Node.js version jest ustawiony na 18+ w Vercel**

---

**Gotowe do wdrożenia! 🎉**


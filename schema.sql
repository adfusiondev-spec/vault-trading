-- ============================================
-- The Vault - Supabase Database Schema
-- ============================================
-- هذا الملف يحتوي على جميع الجداول، السياسات، والـ Triggers
-- ============================================

-- 1. تفعيل الإضافات المطلوبة
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. إنشاء ENUM للأدوار
-- ============================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'sub_admin', 'trader');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. إنشاء ENUM لحالات التداول
-- ============================================
DO $$ BEGIN
    CREATE TYPE trade_status AS ENUM ('open', 'closed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. إنشاء ENUM لحالات المعاملات
-- ============================================
DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. إنشاء ENUM لأنواع المعاملات
-- ============================================
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. إنشاء ENUM لأنواع التداول
-- ============================================
DO $$ BEGIN
    CREATE TYPE trade_type AS ENUM ('buy', 'sell');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- جدول Profiles
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    country TEXT,
    notes TEXT,
    role user_role NOT NULL DEFAULT 'trader',
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- التحقق من أن Sub-Admin لا يمكن أن يكون مرتبطاً بنفسه
    CONSTRAINT no_self_assignment CHECK (id != assigned_to),
    
    -- التحقق من أن Super Admin غير مرتبط بأي شخص
    CONSTRAINT super_admin_no_assignment CHECK (
        role != 'super_admin' OR assigned_to IS NULL
    )
);

-- إنشاء Index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_to ON profiles(assigned_to);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================
-- جدول Wallets (المحافظ)
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    balance DECIMAL(20, 8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- التأكد من أن كل مستخدم لديه محفظة واحدة لكل عملة
    CONSTRAINT unique_user_currency UNIQUE(user_id, currency)
);

-- إنشاء Index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- ============================================
-- جدول Trades (التداولات)
-- ============================================
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL, -- مثل: BTC/USD, ETH/USD
    type trade_type NOT NULL,
    amount DECIMAL(20, 8) NOT NULL CHECK (amount > 0),
    entry_price DECIMAL(20, 8) NOT NULL CHECK (entry_price > 0),
    exit_price DECIMAL(20, 8),
    status trade_status NOT NULL DEFAULT 'open',
    profit_loss DECIMAL(20, 8),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- إنشاء Index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);

-- ============================================
-- جدول Transactions (المعاملات المالية)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount DECIMAL(20, 8) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    status transaction_status NOT NULL DEFAULT 'pending',
    payment_method TEXT, -- مثل: bank_transfer, crypto, paypal
    payment_details JSONB, -- تفاصيل إضافية مثل رقم الحساب، العنوان، إلخ
    admin_notes TEXT, -- ملاحظات المسؤول
    proof_of_payment_url TEXT, -- رابط إثبات الدفع
    destination_address TEXT, -- العنوان الوجهة (للسحب أو المحافظ الخارجية)
    processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- من قام بمعالجة الطلب
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء Index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- ============================================
-- جدول Payment Gateways (بوابات الدفع)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_gateways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- مثل: stripe, paypal, binance
    display_name TEXT NOT NULL,
    type TEXT NOT NULL, -- مثل: fiat, crypto
    is_active BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}', -- إعدادات البوابة (API keys, webhooks, etc)
    supported_currencies TEXT[] NOT NULL DEFAULT '{}',
    min_deposit DECIMAL(20, 8),
    max_deposit DECIMAL(20, 8),
    min_withdrawal DECIMAL(20, 8),
    max_withdrawal DECIMAL(20, 8),
    fees_config JSONB DEFAULT '{}', -- هيكل الرسوم
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء Index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_payment_gateways_is_active ON payment_gateways(is_active);

-- ============================================
-- تفعيل Row Level Security على جميع الجداول
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Function لتخطي الـ Recursion
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- سياسات RLS لجدول Profiles
-- ============================================

-- السماح للجميع بقراءة ملفهم الشخصي
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Super Admin يرى جميع الملفات
DROP POLICY IF EXISTS "Super Admin can view all profiles" ON profiles;
CREATE POLICY "Super Admin can view all profiles"
    ON profiles FOR SELECT
    USING (
        public.get_auth_role() = 'super_admin'
    );

-- Sub Admin يرى الملفات المرتبطة به
DROP POLICY IF EXISTS "Sub Admin can view assigned profiles" ON profiles;
CREATE POLICY "Sub Admin can view assigned profiles"
    ON profiles FOR SELECT
    USING (
        (public.get_auth_role() = 'sub_admin'
            AND (
                -- يرى ملفه الشخصي
                auth.uid() = profiles.id
                OR
                -- يرى المستخدمين المرتبطين به
                auth.uid() = profiles.assigned_to
            )
        )
    );

-- Super Admin يمكنه تعديل جميع الملفات
DROP POLICY IF EXISTS "Super Admin can update all profiles" ON profiles;
CREATE POLICY "Super Admin can update all profiles"
    ON profiles FOR UPDATE
    USING (
        public.get_auth_role() = 'super_admin'
    );

-- Sub Admin يمكنه تعديل الملفات المرتبطة به فقط
DROP POLICY IF EXISTS "Sub Admin can update assigned profiles" ON profiles;
CREATE POLICY "Sub Admin can update assigned profiles"
    ON profiles FOR UPDATE
    USING (
        (public.get_auth_role() = 'sub_admin'
            AND auth.uid() = profiles.assigned_to
        )
    );

-- المستخدمون يمكنهم تعديل ملفهم الشخصي (باستثناء الدور)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Super Admin فقط يمكنه إنشاء ملفات جديدة
DROP POLICY IF EXISTS "Super Admin can insert profiles" ON profiles;
CREATE POLICY "Super Admin can insert profiles"
    ON profiles FOR INSERT
    WITH CHECK (
        public.get_auth_role() = 'super_admin'
    );

-- Super Admin فقط يمكنه حذف الملفات
DROP POLICY IF EXISTS "Super Admin can delete profiles" ON profiles;
CREATE POLICY "Super Admin can delete profiles"
    ON profiles FOR DELETE
    USING (
        public.get_auth_role() = 'super_admin'
    );

-- ============================================
-- سياسات RLS لجدول Wallets
-- ============================================

-- المستخدمون يرون محافظهم فقط
DROP POLICY IF EXISTS "Users can view own wallets" ON wallets;
CREATE POLICY "Users can view own wallets"
    ON wallets FOR SELECT
    USING (auth.uid() = user_id);

-- Super Admin يرى جميع المحافظ
DROP POLICY IF EXISTS "Super Admin can view all wallets" ON wallets;
CREATE POLICY "Super Admin can view all wallets"
    ON wallets FOR SELECT
    USING (
        public.get_auth_role() = 'super_admin'
    );

-- Sub Admin يرى محافظ المستخدمين المرتبطين به
DROP POLICY IF EXISTS "Sub Admin can view assigned wallets" ON wallets;
CREATE POLICY "Sub Admin can view assigned wallets"
    ON wallets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN profiles u ON u.assigned_to = p.id
            WHERE p.id = auth.uid() 
            AND p.role = 'sub_admin'
            AND u.id = wallets.user_id
        )
    );

-- Super Admin و Sub Admin يمكنهم تعديل المحافظ
DROP POLICY IF EXISTS "Admins can update wallets" ON wallets;
CREATE POLICY "Admins can update wallets"
    ON wallets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() 
            AND p.role IN ('super_admin', 'sub_admin')
            AND (
                p.role = 'super_admin'
                OR
                EXISTS (
                    SELECT 1 FROM profiles u
                    WHERE u.id = wallets.user_id AND u.assigned_to = p.id
                )
            )
        )
    );

-- المحافظ يتم إنشاؤها تلقائياً عبر Trigger
DROP POLICY IF EXISTS "System can insert wallets" ON wallets;
CREATE POLICY "System can insert wallets"
    ON wallets FOR INSERT
    WITH CHECK (true);

-- ============================================
-- سياسات RLS لجدول Trades
-- ============================================

-- المستخدمون يرون تداولاتهم فقط
DROP POLICY IF EXISTS "Users can view own trades" ON trades;
CREATE POLICY "Users can view own trades"
    ON trades FOR SELECT
    USING (auth.uid() = user_id);

-- Super Admin يرى جميع التداولات
DROP POLICY IF EXISTS "Super Admin can view all trades" ON trades;
CREATE POLICY "Super Admin can view all trades"
    ON trades FOR SELECT
    USING (
        public.get_auth_role() = 'super_admin'
    );

-- Sub Admin يرى تداولات المستخدمين المرتبطين به
DROP POLICY IF EXISTS "Sub Admin can view assigned trades" ON trades;
CREATE POLICY "Sub Admin can view assigned trades"
    ON trades FOR SELECT
    USING (
        (public.get_auth_role() = 'sub_admin' AND EXISTS (SELECT 1 FROM profiles u WHERE u.assigned_to = auth.uid() AND u.id = trades.user_id))
    );

-- المستخدمون يمكنهم إنشاء تداولات
DROP POLICY IF EXISTS "Users can insert own trades" ON trades;
CREATE POLICY "Users can insert own trades"
    ON trades FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins يمكنهم إنشاء تداولات للمستخدمين
DROP POLICY IF EXISTS "Admins can insert trades" ON trades;
CREATE POLICY "Admins can insert trades"
    ON trades FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() 
            AND p.role IN ('super_admin', 'sub_admin')
            AND (
                p.role = 'super_admin'
                OR
                EXISTS (
                    SELECT 1 FROM profiles u
                    WHERE u.id = trades.user_id AND u.assigned_to = p.id
                )
            )
        )
    );

-- المستخدمون والـ Admins يمكنهم تعديل التداولات
DROP POLICY IF EXISTS "Users and Admins can update trades" ON trades;
CREATE POLICY "Users and Admins can update trades"
    ON trades FOR UPDATE
    USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() 
            AND p.role IN ('super_admin', 'sub_admin')
            AND (
                p.role = 'super_admin'
                OR
                EXISTS (
                    SELECT 1 FROM profiles u
                    WHERE u.id = trades.user_id AND u.assigned_to = p.id
                )
            )
        )
    );

-- Admins فقط يمكنهم حذف التداولات
DROP POLICY IF EXISTS "Admins can delete trades" ON trades;
CREATE POLICY "Admins can delete trades"
    ON trades FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() 
            AND p.role IN ('super_admin', 'sub_admin')
            AND (
                p.role = 'super_admin'
                OR
                EXISTS (
                    SELECT 1 FROM profiles u
                    WHERE u.id = trades.user_id AND u.assigned_to = p.id
                )
            )
        )
    );

-- ============================================
-- سياسات RLS لجدول Transactions
-- ============================================

-- المستخدمون يرون معاملاتهم فقط
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Super Admin يرى جميع المعاملات
DROP POLICY IF EXISTS "Super Admin can view all transactions" ON transactions;
CREATE POLICY "Super Admin can view all transactions"
    ON transactions FOR SELECT
    USING (
        public.get_auth_role() = 'super_admin'
    );

-- Sub Admin يرى معاملات المستخدمين المرتبطين به
DROP POLICY IF EXISTS "Sub Admin can view assigned transactions" ON transactions;
CREATE POLICY "Sub Admin can view assigned transactions"
    ON transactions FOR SELECT
    USING (
        (public.get_auth_role() = 'sub_admin' AND EXISTS (SELECT 1 FROM profiles u WHERE u.assigned_to = auth.uid() AND u.id = transactions.user_id))
    );

-- المستخدمون يمكنهم إنشاء طلبات إيداع/سحب
DROP POLICY IF EXISTS "Users can create own transactions" ON transactions;
CREATE POLICY "Users can create own transactions"
    ON transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins يمكنهم تعديل المعاملات
DROP POLICY IF EXISTS "Admins can update transactions" ON transactions;
CREATE POLICY "Admins can update transactions"
    ON transactions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() 
            AND p.role IN ('super_admin', 'sub_admin')
            AND (
                p.role = 'super_admin'
                OR
                EXISTS (
                    SELECT 1 FROM profiles u
                    WHERE u.id = transactions.user_id AND u.assigned_to = p.id
                )
            )
        )
    );

-- ============================================
-- سياسات RLS لجدول Payment Gateways
-- ============================================

-- الجميع يمكنهم رؤية بوابات الدفع النشطة
DROP POLICY IF EXISTS "Everyone can view active gateways" ON payment_gateways;
CREATE POLICY "Everyone can view active gateways"
    ON payment_gateways FOR SELECT
    USING (is_active = true);

-- Super Admin يرى جميع البوابات
DROP POLICY IF EXISTS "Super Admin can view all gateways" ON payment_gateways;
CREATE POLICY "Super Admin can view all gateways"
    ON payment_gateways FOR SELECT
    USING (
        public.get_auth_role() = 'super_admin'
    );

-- Super Admin فقط يمكنه إدارة البوابات
DROP POLICY IF EXISTS "Super Admin can manage gateways" ON payment_gateways;
CREATE POLICY "Super Admin can manage gateways"
    ON payment_gateways FOR ALL
    USING (
        public.get_auth_role() = 'super_admin'
    );

-- ============================================
-- Functions لتحديث updated_at تلقائياً
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق Trigger على جميع الجداول
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_gateways_updated_at ON payment_gateways;
CREATE TRIGGER update_payment_gateways_updated_at BEFORE UPDATE ON payment_gateways
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Function لإنشاء Profile تلقائياً عند التسجيل
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
        'trader'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger لإنشاء Profile عند التسجيل
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Function لإنشاء محفظة تلقائياً عند إنشاء Profile
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- إنشاء محفظة بالعملة الافتراضية USD
    INSERT INTO public.wallets (user_id, balance, currency)
    VALUES (NEW.id, 0, 'USD');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger لإنشاء محفظة عند إنشاء Profile
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- ============================================
-- Function لتحديث حالة المعاملة وتحديث المحفظة
-- ============================================
CREATE OR REPLACE FUNCTION handle_transaction_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- فقط عند تغيير الحالة من pending إلى approved
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
        -- تحديث رصيد المحفظة
        IF NEW.type = 'deposit' THEN
            -- إضافة المبلغ للمحفظة
            UPDATE wallets
            SET balance = balance + NEW.amount
            WHERE user_id = NEW.user_id AND currency = NEW.currency;
        ELSIF NEW.type = 'withdrawal' THEN
            -- خصم المبلغ من المحفظة
            UPDATE wallets
            SET balance = balance - NEW.amount
            WHERE user_id = NEW.user_id AND currency = NEW.currency;
        END IF;
        
        -- تحديث وقت المعالجة
        NEW.processed_at = NOW();
        NEW.processed_by = auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger لتحديث المحفظة عند الموافقة على المعاملة
DROP TRIGGER IF EXISTS on_transaction_status_change ON transactions;
CREATE TRIGGER on_transaction_status_change
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION handle_transaction_approval();

-- ============================================
-- بيانات افتراضية لبوابات الدفع (اختيارية)
-- ============================================
INSERT INTO payment_gateways (name, display_name, type, is_active, supported_currencies, config)
VALUES 
    (
        'bank_transfer',
        'تحويل بنكي',
        'fiat',
        true,
        ARRAY['USD', 'EUR', 'MAD'],
        '{"instructions": "يرجى التحويل إلى الحساب التالي..."}'::jsonb
    ),
    (
        'crypto_btc',
        'Bitcoin',
        'crypto',
        true,
        ARRAY['BTC'],
        '{"wallet_address": "your-btc-address", "network": "mainnet"}'::jsonb
    ),
    (
        'crypto_usdt',
        'USDT (Tether)',
        'crypto',
        true,
        ARRAY['USDT'],
        '{"wallet_address": "your-usdt-address", "network": "TRC20"}'::jsonb
    )
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Views مفيدة (اختيارية)
-- ============================================

-- View لإحصائيات المستخدمين للـ Admins
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.assigned_to,
    COALESCE(w.balance, 0) as wallet_balance,
    w.currency,
    COUNT(DISTINCT t.id) as total_trades,
    COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END) as open_trades,
    COUNT(DISTINCT tr.id) as total_transactions,
    COUNT(DISTINCT CASE WHEN tr.status = 'pending' THEN tr.id END) as pending_transactions
FROM profiles p
LEFT JOIN wallets w ON p.id = w.user_id
LEFT JOIN trades t ON p.id = t.user_id
LEFT JOIN transactions tr ON p.id = tr.user_id
GROUP BY p.id, p.email, p.full_name, p.role, p.assigned_to, w.balance, w.currency;

-- ============================================
-- Function لتنفيذ عملية تداول (Atomic Transaction)
-- ============================================
-- تم إضافة معامل p_entry_price لأن جدول trades يشترط إدخال القيمة.
CREATE OR REPLACE FUNCTION execute_trade(
    p_user_id UUID,
    p_symbol TEXT,
    p_amount DECIMAL,
    p_type trade_type,
    p_entry_price DECIMAL
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance DECIMAL;
    v_trade_id UUID;
BEGIN
    -- 1. التحقق الاستباقي: تقييد صارم بناءً على القاعدة المعرفية المرجعية
    IF p_symbol NOT IN (
        -- السلع العالمية
        'Gold', 'XAUUSD', 'Crude Oil', 'WTIUSD', 'Brent Crude', 'BRTUSD', 'Silver', 'XAGUSD', 'Natural Gas', 'NGAS', 'Copper', 'Coffee', 'Wheat', 'Soybeans',
        -- المؤشرات العالمية
        'S&P 500', 'Nasdaq 100', 'Dow Jones', 'DAX 40', 'FTSE 100', 'Nikkei 225', 'Hang Seng',
        -- العملات الرقمية
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LTCUSDT',
        -- العملات الأجنبية (Forex)
        'EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'AUDUSD', 'EURJPY', 'GBPJPY',
        -- الأصول السعودية
        'TASI', 'Nomu', 'MT30', 'Aramco', 'Sabic', 'Maaden', 'SSF', 'Sukuk Index'
    ) THEN
        RAISE EXCEPTION 'هذا الأصل غير مسموح. يجب عليك التداول فقط ضمن القاعدة المعرفية المعتمدة (مثل Gold أو S&P 500 أو TASI). الأصل المدخل: %', p_symbol;
    END IF;

    -- قفل الصف الخاص بالمحفظة لمنع التحديثات المتزامنة (Row-Level Lock)
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id AND currency = 'USD'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المحفظة غير موجودة للمستخدم';
    END IF;

    -- التحقق من الرصيد والخصم (بافتراض أن p_amount هو المبلغ الذي سيتم خصمه)
    -- يمكن تعديل هذا ليصبح (p_amount * p_entry_price) إذا كان p_amount هو حجم الأصل.
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ لإتمام العملية (مطلوب %, متوفر %)', p_amount, v_current_balance;
    END IF;

    -- خصم المبلغ
    UPDATE wallets
    SET balance = balance - p_amount
    WHERE id = v_wallet_id;

    -- إدراج سجل التداول
    -- إما أن يتم إكماله كله أو يتراجع كله في حال حدوث خطأ (Atomic Transaction)
    INSERT INTO trades (user_id, symbol, type, amount, entry_price, status)
    VALUES (p_user_id, p_symbol, p_type, p_amount, p_entry_price, 'open')
    RETURNING id INTO v_trade_id;

    -- إعادة النتيجة بنجاح
    RETURN jsonb_build_object(
        'success', true,
        'trade_id', v_trade_id,
        'message', 'تم تنفيذ التداول بنجاح وتم خصم الرصيد'
    );

EXCEPTION
    WHEN OTHERS THEN
        -- في حالة حدوث أي خطأ، سيتم التراجع (Rollback) تلقائياً
        RETURN jsonb_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function إدارية للموافقة على الإيداع (لـ Sub-Admin و Super-Admin)
-- ============================================
CREATE OR REPLACE FUNCTION approve_deposit(
    p_transaction_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_transaction RECORD;
    v_admin_role user_role;
BEGIN
    -- التحقق من صلاحيات المستخدم الحالي (يفترض استدعاؤها مع مصادقة Supabase)
    SELECT role INTO v_admin_role
    FROM profiles
    WHERE id = auth.uid();

    IF v_admin_role NOT IN ('super_admin', 'sub_admin') THEN
        RAISE EXCEPTION 'ليس لديك الصلاحيات الكافية لتنفيذ هذه العملية';
    END IF;

    -- جلب بيانات المعاملة مع قفل الصف لمنع التعديلات المتزامنة
    SELECT * INTO v_transaction
    FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المعاملة غير موجودة';
    END IF;

    IF v_transaction.type != 'deposit' THEN
        RAISE EXCEPTION 'هذه العملية ليست إيداعاً';
    END IF;

    IF v_transaction.status != 'pending' THEN
        RAISE EXCEPTION 'لا يمكن الموافقة على معاملة ليست في حالة انتظار (الحالة الحالية: %)', v_transaction.status;
    END IF;

    -- تحديث حالة المعاملة
    -- سيقوم الـ Trigger المسمى "on_transaction_status_change" بمراقبة هذا التحديث
    -- وسيقوم تلقائياً بزيادة الرصيد في المحفظة في خطوة واحدة
    UPDATE transactions
    SET status = 'approved'
    WHERE id = p_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم الموافقة على الإيداع وإضافة الرصيد للمحفظة بنجاح'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ============================================
-- Migration: Notifications & Subscription Payments
-- ============================================

-- Function to safely get auth role (if not already existing)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- 1. Table: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_role text,
  title text,
  message text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- 2. Table: subscription_payments
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_admin_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL,
  status text DEFAULT 'Pending',
  reference text,
  proof_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all subscription payments"
ON public.subscription_payments FOR SELECT
USING (public.get_auth_role() = 'super_admin');

CREATE POLICY "Super admins can update payments"
ON public.subscription_payments FOR UPDATE
USING (public.get_auth_role() = 'super_admin');

CREATE POLICY "Sub admins can view their own subscription payments"
ON public.subscription_payments FOR SELECT
USING (auth.uid() = sub_admin_id);

CREATE POLICY "Sub admins can insert their own payments"
ON public.subscription_payments FOR INSERT
WITH CHECK (auth.uid() = sub_admin_id);

-- 3. Broadcast real-time changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_payments;


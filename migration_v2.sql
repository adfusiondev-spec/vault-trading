-- ============================================
-- The Vault - Database Migration v2
-- Fixes for Trading and Synchronization
-- ============================================

-- 1. إضافة عمود quantity لجدول trades
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='quantity') THEN
        ALTER TABLE trades ADD COLUMN quantity DECIMAL(20, 8);
    END IF;
END $$;

-- 2. تنظيف البيانات الموجودة: تعيين الكمية للتداولات التي لا تحتوي عليها
-- الكمية = المبلغ / سعر الدخول
UPDATE trades 
SET quantity = amount / entry_price 
WHERE quantity IS NULL AND entry_price > 0;

-- 3. تحديث وظيفة execute_trade لدعم المحاصيل (Quantity)
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
    v_quantity DECIMAL;
BEGIN
    -- حساب الكمية
    v_quantity := p_amount / p_entry_price;

    -- قفل الصف الخاص بالمحفظة لمنع التحديثات المتزامنة
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id AND currency = 'USD'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المحفظة غير موجودة للمستخدم';
    END IF;

    -- التحقق من الرصيد والخصم
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ لإتمام العملية (مطلوب %, متوفر %)', p_amount, v_current_balance;
    END IF;

    -- خصم المبلغ
    UPDATE wallets
    SET balance = balance - p_amount
    WHERE id = v_wallet_id;

    -- إدراج سجل التداول
    INSERT INTO trades (user_id, symbol, type, amount, entry_price, quantity, status)
    VALUES (p_user_id, p_symbol, p_type, p_amount, p_entry_price, v_quantity, 'open')
    RETURNING id INTO v_trade_id;

    RETURN jsonb_build_object(
        'success', true,
        'trade_id', v_trade_id,
        'message', 'تم تنفيذ التداول بنجاح وتم خصم الرصيد'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. إضافة وظيفة لإغلاق التداولات (close_trade)
CREATE OR REPLACE FUNCTION close_trade(
    p_trade_id UUID,
    p_exit_price DECIMAL
)
RETURNS JSONB AS $$
DECLARE
    v_trade RECORD;
    v_wallet_id UUID;
    v_profit_loss DECIMAL;
    v_return_amount DECIMAL;
BEGIN
    -- جلب بيانات التداول
    SELECT * INTO v_trade FROM trades WHERE id = p_trade_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'التداول غير موجود';
    END IF;
    
    IF v_trade.status != 'open' THEN
        RAISE EXCEPTION 'التداول مغلق بالفعل';
    END IF;

    -- حساب الأرباح والخسائر
    -- للقيمة الشرائية: (سعر الخروج - سعر الدخول) * الكمية
    -- للقيمة البيعية: (سعر الدخول - سعر الخروج) * الكمية
    -- استخدام COALESCE للتعامل مع أي بيانات قديمة مفقودة
    IF v_trade.type = 'buy' THEN
        v_profit_loss := (p_exit_price - v_trade.entry_price) * COALESCE(v_trade.quantity, (v_trade.amount / v_trade.entry_price));
    ELSE
        v_profit_loss := (v_trade.entry_price - p_exit_price) * COALESCE(v_trade.quantity, (v_trade.amount / v_trade.entry_price));
    END IF;

    -- المبلغ المسترد للمحفظة هو المبلغ الأصلي + الربح/الخسارة
    v_return_amount := v_trade.amount + v_profit_loss;

    -- تحديث سجل التداول
    UPDATE trades SET
        status = 'closed',
        exit_price = p_exit_price,
        profit_loss = v_profit_loss,
        closed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_trade_id;

    -- تحديث المحفظة
    UPDATE wallets SET
        balance = balance + v_return_amount,
        updated_at = NOW()
    WHERE user_id = v_trade.user_id AND currency = 'USD';

    RETURN jsonb_build_object(
        'success', true,
        'profit_loss', v_profit_loss,
        'return_amount', v_return_amount,
        'message', 'تم إغلاق التداول بنجاح وتحديث الرصيد'
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
-- 5. إضافة عمود plain_password لجدول profiles
-- يُخزَّن بشكل اختياري ليتمكن المشرف من الاطلاع على
-- كلمات المرور التي أنشأها بنفسه لعملائه
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='plain_password') THEN
        ALTER TABLE public.profiles ADD COLUMN plain_password TEXT;
    END IF;
END $$;

-- ============================================
-- 6. إضافة عمود is_banned لجدول profiles
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_banned') THEN
        ALTER TABLE public.profiles ADD COLUMN is_banned BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ============================================
-- 7. تفعيل Realtime على الجداول الأساسية
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

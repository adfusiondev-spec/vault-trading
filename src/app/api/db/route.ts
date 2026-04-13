import { NextResponse } from 'next/server'

// Global object to persist data across hot-reloads and API calls
const globalDB = global as any
if (!globalDB.vaultDb) {
  globalDB.vaultDb = {
    transactions: [],
    orders: []
  }
}

export async function GET() {
  return NextResponse.json(globalDB.vaultDb)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    if (body.type === 'SYNC_TX') {
      globalDB.vaultDb.transactions = body.data
    } else if (body.type === 'SYNC_ORDERS') {
      globalDB.vaultDb.orders = body.data
    } else if (body.type === 'ADD_TX') {
      globalDB.vaultDb.transactions.push(body.data)
    } else if (body.type === 'UPDATE_TX_STATUS') {
      const { id, status } = body.data
      globalDB.vaultDb.transactions = globalDB.vaultDb.transactions.map((tx: any) => 
        tx.id === id ? { ...tx, status } : tx
      )
    } else if (body.type === 'ADD_ORDER') {
      globalDB.vaultDb.orders.push(body.data)
    } else if (body.type === 'UPDATE_ORDER_STATUS') {
      const { id, status, closedTimestamp, exitPrice, pnl, pnlPct } = body.data
      globalDB.vaultDb.orders = globalDB.vaultDb.orders.map((o: any) => 
        o.id === id ? { ...o, status, closedTimestamp, exitPrice, pnl, pnlPct } : o
      )
    } else if (body.type === 'DELETE_ORDER') {
      globalDB.vaultDb.orders = globalDB.vaultDb.orders.filter((o: any) => o.id !== body.data.id)
    } else if (body.type === 'ADD_MOCK_DATA_ONCE') {
       if (globalDB.vaultDb.transactions.length === 0) {
          globalDB.vaultDb.transactions.push({ id: 'F-881', userEmail: 'trader1@institution.io', type: 'Withdrawal', amount: 5000, currency: 'USD', status: 'Pending', timestamp: Date.now() })
       }
    }
    
    return NextResponse.json({ success: true, db: globalDB.vaultDb })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
  }
}

import { request } from './api'


export async function addCredentials(payload){
// POST to /facebook-credentials as requested
return await request('/leadsync/facebook-credentials', { method: 'POST', body: JSON.stringify(payload) })
}



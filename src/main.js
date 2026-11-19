import './main.css';
import { box, getContractData } from './web3/connect';
import { renderPages, mountPages } from './pages';

async function renderApp(wallet) {
    const path = window.location.pathname;
    if (path !== '/') return;

    const data = await getContractData(wallet);

    SSR(data);
}

box.safeRenderApp(renderApp);

function SSR(data) {
    console.log({ data });
    const app = document.querySelector('#app');
    if (!app) return;

    app.innerHTML = /*html*/`
        <div class="w-full">
            ${renderPages(data)}
        </div>
    `;

    mountPages(data);
}

const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router(); // Create an Express router
const puppeteer = require("puppeteer");

router.use(bodyParser.json());

const scrapeInfiniteScrollItems = async (page, itemTargetCount) => {
    let items = [];
  
    while (itemTargetCount > items.length) {
      items = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(".sc-ihiItl"));
        return items.map((item) => item.innerText);
      });
  
      previousHeight = await page.evaluate((selector) => {
        const scrollableDiv = document.querySelector(selector);
        scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
        return scrollableDiv.scrollHeight;
      }, ".sc-iDChAR");
  
      await page.waitForFunction(
        (selector, previousHeight) => {
          const scrollableDiv = document.querySelector(selector);
          return scrollableDiv.scrollHeight > previousHeight;
        },
        { timeout: 0 },
        ".sc-iDChAR",
        previousHeight
      );
  
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  
    return items;
  };


router.get('/stubhubTickets/:eventId', (req, res) => {
    const eventId=req.params.eventId;
    (async () => {
        const browser = await puppeteer.launch({
          
        });
      
        const page = await browser.newPage();
        await page.goto(`https://www.stubhub.com/atlanta-hawks-atlanta-tickets-2-2-2024/event/${eventId}/?quantity=2`);
      
        const items = await scrapeInfiniteScrollItems(page, 500);
      console.log(items.length);
       // fs.writeFileSync("items.json", JSON.stringify(items));
       res.send(items)
        await browser.close();
      })();

  
})

module.exports = router; // Export the router

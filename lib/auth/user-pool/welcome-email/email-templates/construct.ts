import { Construct } from "constructs";
import MerchantConstruct from "./merchant/construct";
// const CustomerConstruct = require("./customer/construct");

interface IEmailTemplatesConstructProps {
  readonly envName: string;
}

class EmailTemplatesConstruct extends Construct {
  merchant: MerchantConstruct;

  constructor(
    scope: Construct,
    id: string,
    props: IEmailTemplatesConstructProps
  ) {
    super(scope, id);

    this.merchant = new MerchantConstruct(this, "MerchantConstruct", {});

    // this.customer = new CustomerConstruct(
    //   this,
    //   "CustomerConstruct",
    //   {}
    // );
  }
}

export default EmailTemplatesConstruct;

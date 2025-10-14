import { Construct } from "constructs";
import {
  ResponsiveEmailTemplate,
  TemplatePart,
} from "@cloudcomponents/cdk-responsive-email-template";

import template from "./template";

interface ICustomerConstructProps {
  readonly envName: string;
}

class CustomerConstruct extends Construct {
  templateName: string;

  constructor(scope: Construct, id: string, props: ICustomerConstructProps) {
    super(scope, id);
    // console.log("(+) template: \n" + JSON.stringify(template, null, 2));

    const { templateName, subjectPart, textPart, htmlPart, parsingOptions } =
      template;

    new ResponsiveEmailTemplate(this, "ResponsiveEmailTemplate", {
      templateName,
      subjectPart,
      textPart: TemplatePart.fromInline(textPart),
      htmlPart: TemplatePart.fromInline(htmlPart),
      parsingOptions,
    });

    this.templateName = templateName;
  }
}

export default CustomerConstruct;
